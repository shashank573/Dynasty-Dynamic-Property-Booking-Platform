const mongoose = require("mongoose");
const Unit = require("../../models/unit.js");
const Booking = require("../../models/booking.js");

const ACTIVE_BOOKING_STATUSES = ["Pending", "Confirmed"];

/**
 * Read-only availability check for one unit and a half-open date interval [start, end).
 * A MongoDB session may be supplied when this check is part of a transaction.
 * This reports current availability; it does not reserve inventory or prevent races.
 */
async function checkUnitAvailability({ unitId, start, end, session = null }) {
    if (!mongoose.isValidObjectId(unitId)) {
        throw new TypeError("A valid unitId is required.");
    }
    const startDate = start instanceof Date ? start : new Date(start);
    const endDate = end instanceof Date ? end : new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
        throw new TypeError("A valid start and end date range is required.");
    }

    let unitQuery = Unit.findById(unitId);
    if (session) unitQuery = unitQuery.session(session);
    const unit = await unitQuery;
    if (!unit) return { available: false, reason: "UNIT_NOT_FOUND", unit: null };

    if (!unit.isAvailable) {
        return { available: false, reason: "UNIT_DISABLED", unit };
    }

    let conflictQuery = Booking.findOne({
        unit: unit._id,
        status: { $in: ACTIVE_BOOKING_STATUSES },
        checkIn: { $lt: endDate },
        checkOut: { $gt: startDate }
    });
    if (session) conflictQuery = conflictQuery.session(session);
    const conflict = await conflictQuery.select("_id").lean();

    return {
        available: !conflict,
        reason: conflict ? "DATE_CONFLICT" : null,
        unit
    };
}

module.exports = { checkUnitAvailability, ACTIVE_BOOKING_STATUSES };
