
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const wrapAsync = require("../utils/wrapAsync.js");
const ExpressError = require("../utils/ExpressError.js");
const { bookingSchema } = require("../schema.js");
const Unit = require("../models/unit.js");
const Booking = require("../models/booking.js");
const { isLoggedIn } = require("../middleware/auth.js");

// Validate the booking request body using the existing Joi schema.
function validateBooking(req, res, next) {
    const { error } = bookingSchema.validate(req.body);

    if (error) {
        const message = error.details
            .map((detail) => detail.message)
            .join(", ");

        return next(new ExpressError(400, message));
    }

    next();
}

// Return today's calendar date in India (IST), as YYYY-MM-DD.
function getTodayInIST() {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(new Date());
}

// Convert a validated YYYY-MM-DD date into a UTC date-only value.
function parseDateOnly(value) {
    const [year, month, day] = value.split("-").map(Number);

    return new Date(Date.UTC(year, month - 1, day));
}

router.post(
    "/",
    isLoggedIn,
    validateBooking,
    wrapAsync(async (req, res) => {
        const { unit: unitId, checkIn, checkOut } = req.body.booking;

        // Reject check-in dates earlier than today's IST calendar date.
        if (checkIn < getTodayInIST()) {
            throw new ExpressError(
                400,
                "Check-in date cannot be in the past."
            );
        }

        const checkInDate = parseDateOnly(checkIn);
        const checkOutDate = parseDateOnly(checkOut);

        const nights = (
            checkOutDate.getTime() - checkInDate.getTime()
        ) / (24 * 60 * 60 * 1000);

        if (!Number.isInteger(nights) || nights <= 0) {
            throw new ExpressError(
                400,
                "Check-out must be after check-in."
            );
        }

        // OS - CRITICAL SECTION:
        // Same Unit document par transactional write concurrent booking
        // attempts ko database level par coordinate karne mein help karta hai.
        const session = await mongoose.startSession();
        let createdBooking;

        try {
            await session.withTransaction(async () => {
                // OS - SHARED RESOURCE LOCKING:
                // Yeh application-level mutex nahi hai. MongoDB ka transactional
                // write conflict same unit ke concurrent transactions ko coordinate karta hai.
                const unitWrite = await Unit.updateOne(
                    { _id: unitId },
                    { $inc: { bookingVersion: 1 } },
                    { session }
                );

                if (unitWrite.matchedCount === 0) {
                    throw new ExpressError(404, "Unit not found.");
                }

                const unit = await Unit.findById(unitId).session(session);

                if (!unit) {
                    throw new ExpressError(404, "Unit not found.");
                }

                if (!unit.isAvailable) {
                    throw new ExpressError(
                        409,
                        "This unit is not available for booking."
                    );
                }

                // OS - CRITICAL SECTION:
                // Overlap check shared Unit write ke baad aur same transaction
                // mein hota hai. Conflict par poori transaction abort hogi.
                const conflictingBooking = await Booking.findOne({
                    unit: unitId,
                    status: { $in: ["Pending", "Confirmed"] },
                    checkIn: { $lt: checkOutDate },
                    checkOut: { $gt: checkInDate }
                }).session(session);

                if (conflictingBooking) {
                    throw new ExpressError(
                        409,
                        "This unit is already booked for the selected dates."
                    );
                }

                // Guest identity aur price client se trust nahi karte.
                const totalPrice = unit.pricePerNight * nights;

                const booking = new Booking({
                    guest: req.session.userId,
                    unit: unit._id,
                    checkIn: checkInDate,
                    checkOut: checkOutDate,
                    totalPrice,
                    status: "Pending"
                });

                await booking.save({ session });

                createdBooking = booking;
            });
        } finally {
            await session.endSession();
        }

        return res.status(201).json({
            message: "Booking created successfully.",
            booking: {
                id: createdBooking._id,
                unit: createdBooking.unit,
                checkIn: createdBooking.checkIn,
                checkOut: createdBooking.checkOut,
                totalPrice: createdBooking.totalPrice,
                status: createdBooking.status
            }
        });
    })
);

module.exports = router;