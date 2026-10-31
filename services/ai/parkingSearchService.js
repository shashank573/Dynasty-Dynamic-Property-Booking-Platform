const mongoose = require("mongoose");
const Listing = require("../../models/listing.js");
const { findAvailableParkingSlots } = require("../availability/parkingAvailabilityService.js");

const DEFAULT_TIME_ZONE = "Asia/Kolkata";
const INDIA_OFFSET_MINUTES = 330;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

const ISO_DATE_TIME_PATTERN = /^(\\d{4})-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2}):(\\d{2})(?:\\.(\\d{1,3}))?(Z|([+-])(\\d{2}):(\\d{2}))$/i;

function parseISODateTime(value, fieldName) {
    if (typeof value !== "string") throw new TypeError(fieldName + " must be an ISO 8601 date-time string with a timezone.");
    const match = ISO_DATE_TIME_PATTERN.exec(value);
    if (!match) throw new TypeError(fieldName + " must use YYYY-MM-DDTHH:mm:ss[.sss] with Z or a timezone offset.");
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    const second = Number(match[6]);
    const timezone = match[8];
    const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1] ||
        hour > 23 || minute > 59 || second > 59) {
        throw new TypeError(fieldName + " is not a valid calendar date-time.");
    }
    if (timezone.toUpperCase() !== "Z") {
        const offsetHour = Number(match[10]);
        const offsetMinute = Number(match[11]);
        if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) {
            throw new TypeError(fieldName + " contains an invalid timezone offset.");
        }
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) throw new TypeError(fieldName + " is not a valid date-time.");
    return parsed;
}

function normalizeRange(startAt, endAt) {
    const start = parseISODateTime(startAt, "startAt");
    const end = parseISODateTime(endAt, "endAt");
    if (end <= start) throw new TypeError("endAt must be later than startAt.");
    return { start, end };
}

function escapeRegex(value) {
    return value.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

function parseCalendarDate(value) {
    if (typeof value !== "string") throw new TypeError("date must be a YYYY-MM-DD calendar date.");
    const match = ISO_DATE_PATTERN.exec(value);
    if (!match) throw new TypeError("date must use YYYY-MM-DD format.");
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) {
        throw new TypeError("date is not a valid calendar date.");
    }
    return { year, month, day };
}

function localIndiaDateTimeToUtc(dateParts, time) {
    if (!TIME_PATTERN.test(time)) throw new TypeError("Times must use 24-hour HH:mm format.");
    const [hour, minute] = time.split(":").map(Number);
    return new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day, hour, minute)
        - INDIA_OFFSET_MINUTES * 60 * 1000);
}

function nextCalendarDate(dateParts) {
    const next = new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day + 1));
    return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
}

async function searchParkingAvailability({ listingName, date, startTime = null, endTime = null } = {}) {
    if (typeof listingName !== "string" || !listingName.trim()) {
        return { success: false, needsClarification: true, clarification: "Which DynaStay property should I check parking for?" };
    }
    if (typeof date !== "string" || !date.trim()) {
        return { success: false, needsClarification: true, clarification: "What date should I check parking for?" };
    }
    if ((startTime === null) !== (endTime === null)) {
        return {
            success: false,
            needsClarification: true,
            clarification: "Please provide both a parking start time and end time, or tell me to check the full day."
        };
    }

    const normalizedName = listingName.trim();
    const dateParts = parseCalendarDate(date);
    const matches = await Listing.find({
        title: { $regex: "^" + escapeRegex(normalizedName) + "$", $options: "i" }
    }).select("_id title location country").limit(2).lean();

    if (matches.length === 0) {
        return {
            success: false,
            needsClarification: true,
            clarification: "I couldn't find a property with that exact name. Could you confirm the property name?"
        };
    }
    if (matches.length > 1) {
        return {
            success: false,
            needsClarification: true,
            clarification: "I found more than one property with that name. Which location do you mean?",
            candidates: matches.map(item => ({ title: item.title, location: item.location || "", country: item.country || "" }))
        };
    }

    let start;
    let end;
    let billingUnit;
    if (startTime === null && endTime === null) {
        start = localIndiaDateTimeToUtc(dateParts, "00:00");
        end = localIndiaDateTimeToUtc(nextCalendarDate(dateParts), "00:00");
        billingUnit = "day";
    } else {
        start = localIndiaDateTimeToUtc(dateParts, startTime);
        end = localIndiaDateTimeToUtc(dateParts, endTime);
        if (end <= start) {
            return {
                success: false,
                needsClarification: true,
                clarification: "The end time must be later than the start time on the same date. What time interval should I check?"
            };
        }
        billingUnit = "hour";
    }

    const listing = matches[0];
    const slots = await findAvailableParkingSlots({ listingId: listing._id, start, end });
    return {
        success: true,
        listing: {
            id: String(listing._id),
            title: listing.title,
            location: listing.location || "",
            country: listing.country || ""
        },
        date,
        timeZone: DEFAULT_TIME_ZONE,
        billingUnit,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        slots: slots.map(slot => ({
            id: String(slot._id),
            slotNumber: slot.slotNumber,
            pricePerHour: slot.pricePerHour,
            pricePerDay: slot.pricePerDay
        }))
    };
}

// Retained for lower-level internal callers that already have a listing ID and UTC interval.
async function searchParkingSpaces({ listingId, startAt, endAt } = {}) {
    if (!mongoose.isValidObjectId(listingId)) throw new TypeError("A valid listingId is required.");
    const { start, end } = normalizeRange(startAt, endAt);
    const listing = await Listing.findById(listingId).select("title location country").lean();
    if (!listing) {
        const error = new Error("Property not found.");
        error.code = "LISTING_NOT_FOUND";
        throw error;
    }
    const slots = await findAvailableParkingSlots({ listingId, start, end });
    return {
        listing: { id: String(listing._id), title: listing.title, location: listing.location || "", country: listing.country || "" },
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        slots: slots.map(slot => ({ id: String(slot._id), slotNumber: slot.slotNumber, pricePerHour: slot.pricePerHour, pricePerDay: slot.pricePerDay }))
    };
}

module.exports = { searchParkingAvailability, searchParkingSpaces, parseCalendarDate, parseISODateTime, normalizeRange, localIndiaDateTimeToUtc, DEFAULT_TIME_ZONE };
