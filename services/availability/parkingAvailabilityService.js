const mongoose = require("mongoose");
const Parking = require("../../models/parking.js");
const ParkingReservation = require("../../models/parkingReservation.js");

const ACTIVE_PARKING_STATUSES = ["Pending", "Confirmed"];

function normalizeRange(start, end) {
    const startDate = start instanceof Date ? start : new Date(start);
    const endDate = end instanceof Date ? end : new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
        throw new TypeError("A valid start and end date range is required.");
    }
    return { start: startDate, end: endDate };
}

/**
 * Read-only availability check for a single parking slot and [start, end) interval.
 * A MongoDB session may be supplied inside an existing transaction.
 */
async function isParkingSlotAvailable({ parkingId, start, end, session = null }) {
    if (!mongoose.isValidObjectId(parkingId)) {
        throw new TypeError("A valid parkingId is required.");
    }
    const range = normalizeRange(start, end);
    let slotQuery = Parking.findOne({ _id: parkingId, isActive: true });
    if (session) slotQuery = slotQuery.session(session);
    const slot = await slotQuery;
    if (!slot) return false;

    let conflictQuery = ParkingReservation.exists({
        parking: slot._id,
        status: { $in: ACTIVE_PARKING_STATUSES },
        startAt: { $lt: range.end },
        endAt: { $gt: range.start }
    });
    if (session) conflictQuery = conflictQuery.session(session);
    return !(await conflictQuery);
}

/**
 * Returns active slots for a listing with no overlapping active reservations.
 * Uses one reservation query for all slots rather than one query per slot.
 * This is an informational read, not a reservation guarantee.
 */
async function findAvailableParkingSlots({ listingId, start, end, session = null }) {
    if (!mongoose.isValidObjectId(listingId)) {
        throw new TypeError("A valid listingId is required.");
    }
    const range = normalizeRange(start, end);

    let slotsQuery = Parking.find({ listing: listingId, isActive: true }).sort({ slotNumber: 1 }).lean();
    if (session) slotsQuery = slotsQuery.session(session);
    const slots = await slotsQuery;
    if (!slots.length) return [];

    const slotIds = slots.map(slot => slot._id);
    let reservationsQuery = ParkingReservation.find({
        parking: { $in: slotIds },
        status: { $in: ACTIVE_PARKING_STATUSES },
        startAt: { $lt: range.end },
        endAt: { $gt: range.start }
    }).select("parking").lean();
    if (session) reservationsQuery = reservationsQuery.session(session);
    const reservations = await reservationsQuery;
    const occupiedIds = new Set(reservations.map(item => String(item.parking)));

    return slots.filter(slot => !occupiedIds.has(String(slot._id)));
}

module.exports = {
    findAvailableParkingSlots,
    isParkingSlotAvailable,
    ACTIVE_PARKING_STATUSES
};
