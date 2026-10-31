const Listing = require("../../models/listing.js");
const Unit = require("../../models/unit.js");

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;
const MAX_CANDIDATE_LISTINGS = 100;
const MAX_UNITS_PER_LISTING = 5;

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeText(value, fieldName) {
    if (value === undefined || value === null || value === "") return undefined;
    if (typeof value !== "string" || !value.trim()) {
        throw new TypeError(`${fieldName} must be a non-empty string.`);
    }
    return value.trim();
}

function normalizeNumber(value, fieldName) {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        throw new TypeError(`${fieldName} must be a non-negative number.`);
    }
    return value;
}

/**
 * Search real listings and their currently enabled bookable units.
 * Price and capacity filters apply to Unit fields, never Listing.price.
 * Results are informational and do not guarantee date-specific availability.
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
        throw new TypeError(`limit must be an integer between 1 and ${MAX_LIMIT}.`);
    }

    const listingFilter = {};
    if (normalizedLocation) listingFilter.location = new RegExp(escapeRegex(normalizedLocation), "i");
    if (normalizedCountry) listingFilter.country = new RegExp(escapeRegex(normalizedCountry), "i");

    // Fetch a bounded candidate set, then apply the requested result limit only
    // after finding listings that actually have matching enabled units.
    const listings = await Listing.find(listingFilter)
        .select("title description image location country")
        .sort({ title: 1 })
        .limit(MAX_CANDIDATE_LISTINGS)
        .lean();

    if (!listings.length) return [];

    const unitFilter = {
        listing: { $in: listings.map(listing => listing._id) },
        isAvailable: true
    };
    if (normalizedMinPrice !== undefined || normalizedMaxPrice !== undefined) {
        unitFilter.pricePerNight = {};
        if (normalizedMinPrice !== undefined) unitFilter.pricePerNight.$gte = normalizedMinPrice;
        if (normalizedMaxPrice !== undefined) unitFilter.pricePerNight.$lte = normalizedMaxPrice;
    }
    if (normalizedMinCapacity !== undefined) {
        unitFilter.capacity = { $gte: normalizedMinCapacity };
    }

    const units = await Unit.find(unitFilter)
        .select("listing name description capacity pricePerNight")
        .sort({ pricePerNight: 1, name: 1 })
        .lean();

    const unitsByListing = new Map();
    for (const unit of units) {
        const key = String(unit.listing);
        if (!unitsByListing.has(key)) unitsByListing.set(key, []);
        const listingUnits = unitsByListing.get(key);
        if (listingUnits.length < MAX_UNITS_PER_LISTING) {
            listingUnits.push({
                id: String(unit._id),
                name: unit.name,
                description: unit.description,
                capacity: unit.capacity,
                pricePerNight: unit.pricePerNight
            });
        }
    }

    return listings
        .filter(listing => unitsByListing.has(String(listing._id)))
        .slice(0, limit)
        .map(listing => ({
            id: String(listing._id),
            title: listing.title,
            description: listing.description || "",
            image: listing.image,
            location: listing.location || "",
            country: listing.country || "",
            units: unitsByListing.get(String(listing._id))
        }));
}

module.exports = {
    searchProperties,
    DEFAULT_LIMIT,
    MAX_LIMIT,
    MAX_CANDIDATE_LISTINGS,
    MAX_UNITS_PER_LISTING
};
