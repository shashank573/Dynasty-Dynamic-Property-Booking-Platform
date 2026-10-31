const mongoose = require("mongoose");
const Listing = require("../../models/listing.js");
const { findAvailableParkingSlots } = require("../availability/parkingAvailabilityService.js");

function normalizeRange(startAt, endAt) {
    if (typeof startAt !== "string" || typeof endAt !== "string") {
        throw new TypeError("startAt and endAt must be date-time strings.");
    }
    const start = new Date(startAt);
    const end = new Date(endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
        throw new TypeError("A valid startAt and endAt range is required.");
    }
    return { start, end };
}

/**
 * Search currently free parking slots for one listing and time interval.
 * This is read-only; it does not reserve a slot or guarantee future availability.
 */
async function searchParkingSpaces({ listingId, startAt, endAt } = {}) {
    if (!mongoose.isValidObjectId(listingId)) {
        throw new TypeError("A valid listingId is required.");
    }
    const range = normalizeRange(startAt, endAt);
    const listing = await Listing.findById(listingId)
        .select("title location country")
        .lean();

    if (!listing) {
        const error = new Error("Property not found.");
        error.code = "LISTING_NOT_FOUND";
        throw error;
    }

    const slots = await findAvailableParkingSlots({
        listingId,
        start: range.start,
        end: range.end
    });

    return {
        listing: {
            id: String(listing._id),
            title: listing.title,
            location: listing.location || "",
            country: listing.country || ""
        },
        startAt: range.start.toISOString(),
        endAt: range.end.toISOString(),
        slots: slots.map(slot => ({
            id: String(slot._id),
            slotNumber: slot.slotNumber,
            pricePerHour: slot.pricePerHour,
            pricePerDay: slot.pricePerDay
        }))
    };
}

module.exports = { searchParkingSpaces };
