const chatTools = [
    {
        type: "function",
        name: "searchProperties",
        description: "Search DynaStay listings and their enabled bookable units. Price and capacity filters apply to units. This is a search only and does not check date-specific booking availability.",
        strict: true,
        parameters: {
            type: "object",
            properties: {
                location: { type: ["string", "null"], description: "Partial property location, or null for any location." },
                country: { type: ["string", "null"], description: "Partial country name, or null for any country." },
                minPrice: { type: ["number", "null"], description: "Minimum unit price per night, or null." },
                maxPrice: { type: ["number", "null"], description: "Maximum unit price per night, or null." },
                minCapacity: { type: ["integer", "null"], description: "Minimum number of guests a unit accommodates, or null." },
                limit: { type: ["integer", "null"], description: "Maximum number of listings, from 1 to 10; use null for the default." }
            },
            required: ["location", "country", "minPrice", "maxPrice", "minCapacity", "limit"],
            additionalProperties: false
        }
    },
    {
        type: "function",
        name: "searchParkingSpaces",
        description: "Find active, currently unoccupied parking slots for a DynaStay listing and time interval. This is read-only and does not reserve a slot.",
        strict: true,
        parameters: {
            type: "object",
            properties: {
                listingId: { type: "string", description: "MongoDB ObjectId of the listing." },
                startAt: { type: "string", description: "Reservation start as an ISO 8601 date-time with timezone." },
                endAt: { type: "string", description: "Reservation end as an ISO 8601 date-time with timezone." }
            },
            required: ["listingId", "startAt", "endAt"],
            additionalProperties: false
        }
    }
];

module.exports = { chatTools };
