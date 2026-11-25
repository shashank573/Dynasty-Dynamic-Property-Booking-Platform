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
        description: "Check parking availability for a DynaStay property by its exact displayed property name and date. For a full calendar day, set both times to null. For hourly availability, provide both 24-hour startTime and endTime. The backend uses India Standard Time (Asia/Kolkata). This is read-only and never reserves parking.",
        strict: true,
        parameters: {
            type: "object",
            properties: {
                listingName: { type: ["string", "null"], description: "Exact property title shown on DynaStay, or null if not provided." },
                date: { type: ["string", "null"], description: "Date in YYYY-MM-DD format. Interpret DD/MM/YYYY user input as day/month/year." },
                startTime: { type: ["string", "null"], description: "Optional local start time in 24-hour HH:mm format. Null means full-day search when endTime is also null." },
                endTime: { type: ["string", "null"], description: "Optional local end time in 24-hour HH:mm format. Null means full-day search when startTime is also null." }
            },
            required: ["listingName", "date", "startTime", "endTime"],
            additionalProperties: false
        }
    }
];

module.exports = { chatTools };
