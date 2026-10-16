const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Parking = require("../models/parking");
const ParkingReservation = require("../models/parkingReservation");
const Listing = require("../models/listing");
const { isLoggedIn } = require("../middleware/auth");

const activeStatuses = ["Pending", "Confirmed"];

function parseRange(startAt, endAt) {
    const start = new Date(startAt);
    const end = new Date(endAt);
    if (!startAt || !endAt || Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime()) || end <= start) return null;
    return { start, end };
}

router.get("/availability", isLoggedIn, async (req, res, next) => {
    try {
        const range = parseRange(req.query.startAt, req.query.endAt);
        if (!mongoose.isValidObjectId(req.query.listingId) || !range) {
            return res.status(400).json({ error: "Valid listingId, startAt and endAt are required." });
        }
        const slots = await Parking.find({ listing: req.query.listingId, isActive: true }).lean();
        const available = [];
        for (const slot of slots) {
            const conflict = await ParkingReservation.exists({
                parking: slot._id, status: { $in: activeStatuses },
                startAt: { $lt: range.end }, endAt: { $gt: range.start }
            });
            if (!conflict) available.push(slot);
        }
        return res.status(200).json({ slots: available });
    } catch (error) { next(error); }
});

router.post("/reservations", isLoggedIn, async (req, res, next) => {
    const session = await mongoose.startSession();
    try {
        const { listingId, startAt, endAt, billingUnit = "hour", parkingId } = req.body;
        const range = parseRange(startAt, endAt);
        if (!mongoose.isValidObjectId(listingId) || !range ||
            !["hour", "day"].includes(billingUnit) ||
            (parkingId && !mongoose.isValidObjectId(parkingId))) {
            return res.status(400).json({ error: "Valid listingId, parkingId (optional), startAt, endAt and billingUnit are required." });
        }
        if (range.start <= new Date()) {
            return res.status(400).json({ error: "Parking reservations must start in the future." });
        }
        const listingExists = await Listing.exists({ _id: listingId });
        if (!listingExists) return res.status(404).json({ error: "Property not found." });

        let reservation;
        await session.withTransaction(async () => {
            const filter = { listing: listingId, isActive: true };
            if (parkingId) filter._id = parkingId;
            const slots = await Parking.find(filter).sort({ slotNumber: 1 }).session(session);
            for (const slot of slots) {
                // Shared write makes concurrent attempts for this slot conflict at the database level.
                const write = await Parking.updateOne(
                    { _id: slot._id, isActive: true },
                    { $inc: { bookingVersion: 1 } }, { session }
                );
                if (!write.matchedCount) continue;
                const conflict = await ParkingReservation.exists({
                    parking: slot._id, status: { $in: activeStatuses },
                    startAt: { $lt: range.end }, endAt: { $gt: range.start }
                }).session(session);
                if (conflict) continue;

                const durationHours = (range.end - range.start) / 3600000;
                const amount = billingUnit === "hour"
                    ? Math.ceil(durationHours) * slot.pricePerHour
                    : Math.ceil(durationHours / 24) * slot.pricePerDay;
                [reservation] = await ParkingReservation.create([{
                    guest: req.session.userId, parking: slot._id,
                    startAt: range.start, endAt: range.end,
                    reservationType: "independent", billingUnit,
                    totalPrice: amount, status: "Confirmed"
                }], { session });
                break;
            }
            if (!reservation) {
                const error = new Error("No parking slot is available for the selected time range.");
                error.statusCode = 409;
                throw error;
            }
        });
        return res.status(201).json({ message: "Parking reserved successfully.", reservation });
    } catch (error) {
        if (error.statusCode === 409) return res.status(409).json({ error: error.message });
        next(error);
    } finally {
        await session.endSession();
    }
});

router.get("/reservations/mine", isLoggedIn, async (req, res, next) => {
    try {
        const reservations = await ParkingReservation.find({ guest: req.session.userId })
            .populate("parking", "listing slotNumber").sort({ createdAt: -1 });
        return res.status(200).json({ reservations });
    } catch (error) { next(error); }
});

router.patch("/reservations/:id/cancel", isLoggedIn, async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ error: "Invalid reservation ID." });
        }
        const reservation = await ParkingReservation.findOne({
            _id: req.params.id, guest: req.session.userId
        });
        if (!reservation) return res.status(404).json({ error: "Parking reservation not found." });
        if (reservation.status === "Cancelled") {
            return res.status(409).json({ error: "Reservation is already cancelled." });
        }
        if (reservation.reservationType === "property") {
            return res.status(409).json({ error: "Property-linked parking must be cancelled through the property booking workflow." });
        }
        reservation.status = "Cancelled";
        await reservation.save();
        return res.status(200).json({ message: "Parking reservation cancelled.", reservation });
    } catch (error) { next(error); }
});

module.exports = router;
