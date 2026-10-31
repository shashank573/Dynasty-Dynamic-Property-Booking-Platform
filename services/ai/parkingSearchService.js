const mongoose = require("mongoose");
const Listing = require("../../models/listing.js");
const { findAvailableParkingSlots } = require("../availability/parkingAvailabilityService.js");

const ISO_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|([+-])(\d{2}):(\d{2}))$/i;

function parseISODateTime(value, fieldName) {
    if (typeof value !== "string") {
        throw new TypeError(fieldName + " must be an ISO 8601 date-time string with a timezone.");
    }

    const match = ISO_DATE_TIME_PATTERN.exec(value);
    if (!match) {
        throw new TypeError(fieldName + " must use YYYY-MM-DDTHH:mm:ss[.sss] with Z or a timezone offset.");
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    const second = Number(match[6]);
    const timezone = match[8];
    const offsetHourText = match[10];
    const offsetMinuteText = match[11];

    const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    if (
        year < 1 || month < 1 || month > 12 ||
        day < 1 || day > daysInMonth[month - 1] ||
        hour > 23 || minute > 59 || second > 59
    ) {
        throw new TypeError(fieldName + " is not a valid calendar date-time.");
    }

    if (timezone.toUpperCase() !== "Z") {
        const offsetHour = Number(offsetHourText);
        const offsetMinute = Number(offsetMinuteText);
        if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) {
            throw new TypeError(fieldName + " contains an invalid timezone offset.");
        }
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        throw new TypeError(fieldName + " is not a valid date-time.");
    }
    return parsed;
}

function normalizeRange(startAt, endAt) {
    const start = parseISODateTime(startAt, "startAt");
    const end = parseISODateTime(endAt, "endAt");
    if (end <= start) {
        throw new TypeError("endAt must be later than startAt.");
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

module.exports = { searchParkingSpaces, normalizeRange, parseISODateTime };
