const { searchProperties } = require("./propertySearchService.js");
const { searchParkingAvailability } = require("./parkingSearchService.js");

const TOOL_ARGUMENT_KEYS = {
    searchProperties: ["location", "country", "minPrice", "maxPrice", "minCapacity", "limit"],
    searchParkingSpaces: ["listingName", "date", "startTime", "endTime"]
};

function parseAndValidateArguments(toolName, rawArguments) {
    const allowedKeys = TOOL_ARGUMENT_KEYS[toolName];
    if (!allowedKeys) throw new TypeError("Unsupported assistant tool.");

    let args;
    try {
        args = typeof rawArguments === "string" ? JSON.parse(rawArguments) : rawArguments;
    } catch {
        throw new TypeError("Tool arguments must contain valid JSON.");
    }

    if (!args || typeof args !== "object" || Array.isArray(args)) {
        throw new TypeError("Tool arguments must be a JSON object.");
    }
    if (Object.keys(args).some(key => !allowedKeys.includes(key))) {
        throw new TypeError("Tool arguments contain unsupported fields.");
    }
    if (allowedKeys.some(key => !Object.prototype.hasOwnProperty.call(args, key))) {
        throw new TypeError("Tool arguments are missing required fields.");
    }
    return args;
}

async function executeChatTool(toolName, rawArguments) {
    try {
        const args = parseAndValidateArguments(toolName, rawArguments);
        if (toolName === "searchProperties") {
            if (args.limit === null) args.limit = undefined;
            return { success: true, properties: await searchProperties(args) };
        }
        if (toolName === "searchParkingSpaces") {
            return await searchParkingAvailability(args);
        }
        return { success: false, error: "Unsupported assistant tool." };
    } catch (error) {
        if (error instanceof TypeError || error instanceof RangeError) {
            return { success: false, error: error.message };
        }
        if (error.code === "LISTING_NOT_FOUND") {
            return { success: false, error: "Property not found." };
        }
        return { success: false, error: "The requested search could not be completed." };
    }
}

module.exports = {
    executeChatTool,
    parseAndValidateArguments,
    TOOL_ARGUMENT_KEYS
};
