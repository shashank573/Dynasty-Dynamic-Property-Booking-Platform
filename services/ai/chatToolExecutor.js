const { searchProperties } = require("./propertySearchService.js");
const { searchParkingSpaces } = require("./parkingSearchService.js");

const TOOL_ARGUMENT_KEYS = {
    searchProperties: ["location", "country", "minPrice", "maxPrice", "minCapacity", "limit"],
    searchParkingSpaces: ["listingId", "startAt", "endAt"]
};

function parseAndValidateArguments(toolName, rawArguments) {
    const allowedKeys = TOOL_ARGUMENT_KEYS[toolName];
    if (!allowedKeys) {
        throw new TypeError("Unsupported assistant tool.");
    }

    let args;
    try {
        args = typeof rawArguments === "string" ? JSON.parse(rawArguments) : rawArguments;
    } catch {
        throw new TypeError("Tool arguments must contain valid JSON.");
    }

    if (!args || typeof args !== "object" || Array.isArray(args)) {
        throw new TypeError("Tool arguments must be a JSON object.");
    }

    const receivedKeys = Object.keys(args);
    if (receivedKeys.some(key => !allowedKeys.includes(key))) {
        throw new TypeError("Tool arguments contain unsupported fields.");
    }
    if (allowedKeys.some(key => !Object.prototype.hasOwnProperty.call(args, key))) {
        throw new TypeError("Tool arguments are missing required fields.");
    }

    return args;
}

/**
 * Execute only the explicitly allowlisted read-only search tools.
 * Tool failures are converted to safe messages for the model.
 */
async function executeChatTool(toolName, rawArguments) {
    try {
        const args = parseAndValidateArguments(toolName, rawArguments);

        if (toolName === "searchProperties") {
            if (args.limit === null) args.limit = undefined;
            const properties = await searchProperties(args);
            return { success: true, properties };
        }

        if (toolName === "searchParkingSpaces") {
            const parking = await searchParkingSpaces(args);
            return { success: true, ...parking };
        }

        return { success: false, error: "Unsupported assistant tool." };
    } catch (error) {
        if (error instanceof TypeError || error instanceof RangeError) {
            return { success: false, error: error.message };
        }
        if (error.code === "LISTING_NOT_FOUND") {
            return { success: false, error: "Property not found." };
        }

        // Do not pass database/provider errors or internal details to the model.
        return { success: false, error: "The requested search could not be completed." };
    }
}

module.exports = {
    executeChatTool,
    parseAndValidateArguments,
    TOOL_ARGUMENT_KEYS
};
