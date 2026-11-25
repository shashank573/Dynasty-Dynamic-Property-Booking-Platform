const Listing = require("../../models/listing.js");
const Unit = require("../../models/unit.js");

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;
const MAX_UNITS_PER_LISTING = 5;

function escapeRegex(value) {
    return value.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

function normalizeText(value, fieldName) {
    if (value === undefined || value === null || value === "") return undefined;
    if (typeof value !== "string" || !value.trim()) {
        throw new TypeError(fieldName + " must be a non-empty string.");
    }
    return value.trim();
}

function normalizeNumber(value, fieldName) {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        throw new TypeError(fieldName + " must be a non-negative number.");
    }
    return value;
}

/**
 * Search real listings and their currently enabled bookable units.
 * Filtering and final listing limits run in MongoDB, so early non-matches
 * cannot hide valid results beyond an arbitrary candidate-listing cap.
 */
async function searchProperties({
    location,
    country,
    minPrice,
    maxPrice,
    minCapacity,
    limit = DEFAULT_LIMIT
} = {}) {
    const normalizedLocation = normalizeText(location, "location");
    const normalizedCountry = normalizeText(country, "country");
    const normalizedMinPrice = normalizeNumber(minPrice, "minPrice");
    const normalizedMaxPrice = normalizeNumber(maxPrice, "maxPrice");
    const normalizedMinCapacity = normalizeNumber(minCapacity, "minCapacity");

    if (normalizedMinCapacity !== undefined && !Number.isInteger(normalizedMinCapacity)) {
        throw new TypeError("minCapacity must be a whole number.");
    }
    if (normalizedMinPrice !== undefined && normalizedMaxPrice !== undefined &&
        normalizedMinPrice > normalizedMaxPrice) {
        throw new TypeError("minPrice cannot be greater than maxPrice.");
    }
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT)) {
        throw new TypeError("limit must be an integer between 1 and " + MAX_LIMIT + ".");
    }

    const listingFilter = {};
    if (normalizedLocation) listingFilter.location = new RegExp(escapeRegex(normalizedLocation), "i");
    if (normalizedCountry) listingFilter.country = new RegExp(escapeRegex(normalizedCountry), "i");

    const unitConditions = [
        { $eq: ["$listing", "$$listingId"] },
        { $eq: ["$isAvailable", true] }
    ];
    if (normalizedMinPrice !== undefined) {
        unitConditions.push({ $gte: ["$pricePerNight", normalizedMinPrice] });
    }
    if (normalizedMaxPrice !== undefined) {
        unitConditions.push({ $lte: ["$pricePerNight", normalizedMaxPrice] });
    }
    if (normalizedMinCapacity !== undefined) {
        unitConditions.push({ $gte: ["$capacity", normalizedMinCapacity] });
    }

    const listings = await Listing.aggregate([
        { $match: listingFilter },
        { $sort: { title: 1, _id: 1 } },
        {
            $lookup: {
                from: Unit.collection.name,
                let: { listingId: "$_id" },
                pipeline: [
                    { $match: { $expr: { $and: unitConditions } } },
                    { $sort: { pricePerNight: 1, name: 1, _id: 1 } },
                    { $limit: MAX_UNITS_PER_LISTING },
                    {
                        $project: {
                            name: 1,
                            description: 1,
                            capacity: 1,
                            pricePerNight: 1
                        }
                    }
                ],
                as: "units"
            }
        },
        { $match: { "units.0": { $exists: true } } },
        { $limit: limit },
        {
            $project: {
                title: 1,
                description: 1,
                image: 1,
                location: 1,
                country: 1,
                units: 1
            }
        }
    ]);

    return listings.map(listing => ({
        id: String(listing._id),
        title: listing.title,
        description: listing.description || "",
        image: listing.image,
        location: listing.location || "",
        country: listing.country || "",
        units: listing.units.map(unit => ({
            id: String(unit._id),
            name: unit.name,
            description: unit.description || "",
            capacity: unit.capacity,
            pricePerNight: unit.pricePerNight
        }))
    }));
}

module.exports = {
    searchProperties,
    DEFAULT_LIMIT,
    MAX_LIMIT,
    MAX_UNITS_PER_LISTING
};
