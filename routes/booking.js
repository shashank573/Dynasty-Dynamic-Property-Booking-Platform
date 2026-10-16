const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const wrapAsync = require("../utils/wrapAsync.js");
const ExpressError = require("../utils/ExpressError.js");
const { bookingSchema } = require("../schema.js");
const Unit = require("../models/unit.js");
const Booking = require("../models/booking.js");
const Parking = require("../models/parking.js");
const ParkingReservation = require("../models/parkingReservation.js");
const { isLoggedIn } = require("../middleware/auth.js");

function validateBooking(req, res, next) {
    const { error } = bookingSchema.validate(req.body);
    if (error) {
        return next(new ExpressError(400, error.details.map(d => d.message).join(", ")));
    }
    next();
}

function getTodayInIST() {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit"
    }).format(new Date());
}

function parseDateOnly(value) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
}

router.post("/", isLoggedIn, validateBooking, wrapAsync(async (req, res) => {
    const { unit: unitId, checkIn, checkOut, parkingChoice } = req.body.booking;
    if (parkingChoice && !["with", "without", "cancel"].includes(parkingChoice)) {
        throw new ExpressError(400, "Invalid parking choice.");
    }
    if (parkingChoice === "cancel") {
        return res.status(200).json({ message: "Property booking cancelled before creation." });
    }
    if (checkIn < getTodayInIST()) throw new ExpressError(400, "Check-in date cannot be in the past.");

    const checkInDate = parseDateOnly(checkIn);
    const checkOutDate = parseDateOnly(checkOut);
    const nights = (checkOutDate.getTime() - checkInDate.getTime()) / 86400000;
    if (!Number.isInteger(nights) || nights <= 0) throw new ExpressError(400, "Check-out must be after check-in.");

    const session = await mongoose.startSession();
    let createdBooking;
    let assignedParking = null;
    let parkingUnavailable = false;

    try {
        await session.withTransaction(async () => {
            const unitWrite = await Unit.updateOne(
                { _id: unitId }, { $inc: { bookingVersion: 1 } }, { session }
            );
            if (!unitWrite.matchedCount) throw new ExpressError(404, "Unit not found.");

            const unit = await Unit.findById(unitId).session(session);
            if (!unit) throw new ExpressError(404, "Unit not found.");
            if (!unit.isAvailable) throw new ExpressError(409, "This unit is not available for booking.");

            const conflict = await Booking.findOne({
                unit: unitId, status: { $in: ["Pending", "Confirmed"] },
                checkIn: { $lt: checkOutDate }, checkOut: { $gt: checkInDate }
            }).session(session);
            if (conflict) throw new ExpressError(409, "This unit is already booked for the selected dates.");

            // Parking is optional. "with" means the guest already explicitly accepted parking;
            // no choice + no slot returns a choice prompt without committing a property booking.
            if (parkingChoice !== "without") {
                const slots = await Parking.find({
                    listing: unit.listing, isActive: true
                }).sort({ slotNumber: 1 }).session(session);

                for (const slot of slots) {
                    await Parking.updateOne(
                        { _id: slot._id, isActive: true },
                        { $inc: { bookingVersion: 1 } }, { session }
                    );
                    const parkingConflict = await ParkingReservation.findOne({
                        parking: slot._id, status: { $in: ["Pending", "Confirmed"] },
                        startAt: { $lt: checkOutDate }, endAt: { $gt: checkInDate }
                    }).session(session);
                    if (!parkingConflict) {
                        assignedParking = slot;
                        break;
                    }
                }

                if (!assignedParking) {
                    if (parkingChoice === "with") {
                        throw new ExpressError(409, "Parking is no longer available. Choose to continue without parking or cancel.");
                    }
                    parkingUnavailable = true;
                    const prompt = new Error("No parking slot is available for these dates.");
                    prompt.statusCode = 460;
                    throw prompt;
                }
            }

            const booking = new Booking({
                guest: req.session.userId, unit: unit._id,
                checkIn: checkInDate, checkOut: checkOutDate,
                totalPrice: unit.pricePerNight * nights, status: "Pending"
            });
            await booking.save({ session });
            createdBooking = booking;

            if (assignedParking) {
                const [reservation] = await ParkingReservation.create([{
                    guest: req.session.userId, parking: assignedParking._id,
                    startAt: checkInDate, endAt: checkOutDate,
                    reservationType: "property", booking: booking._id,
                    billingUnit: "free", totalPrice: 0, status: "Confirmed"
                }], { session });
                assignedParking = { id: assignedParking._id, slotNumber: assignedParking.slotNumber, reservationId: reservation._id };
            }
        });
    } catch (error) {
        if (error.statusCode === 460 || parkingUnavailable) {
            return res.status(409).json({
                requiresParkingChoice: true,
                message: "Parking is unavailable for these dates.",
                choices: ["without", "cancel"],
                instruction: "Resubmit the same booking with booking[parkingChoice]=without to continue without parking, or booking[parkingChoice]=cancel to cancel."
            });
        }
        throw error;
    } finally {
        await session.endSession();
    }

    return res.status(201).json({
        message: "Booking created successfully.",
        booking: {
            id: createdBooking._id, unit: createdBooking.unit,
            checkIn: createdBooking.checkIn, checkOut: createdBooking.checkOut,
            totalPrice: createdBooking.totalPrice, status: createdBooking.status
        },
        parking: assignedParking || null
    });
}));

module.exports = router;
