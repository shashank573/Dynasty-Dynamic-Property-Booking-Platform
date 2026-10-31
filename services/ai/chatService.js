const OpenAI = require("openai");

const DEFAULT_MODEL = "gpt-5.5";
const MAX_MESSAGE_LENGTH = 2000;

let openAIClient;

function getOpenAIClient() {
    if (!process.env.OPENAI_API_KEY) {
        const error = new Error("AI service is not configured.");
        error.code = "AI_NOT_CONFIGURED";
        throw error;
    }

    if (!openAIClient) {
        openAIClient = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            timeout: 20000,
            maxRetries: 1
        });
    }

    return openAIClient;
}

async function generateChatReply(message) {
    if (typeof message !== "string") {
        throw new TypeError("Message must be a string.");
    }

    const normalizedMessage = message.trim();

    if (!normalizedMessage || normalizedMessage.length > MAX_MESSAGE_LENGTH) {
        throw new RangeError("Message length is invalid.");
    }

    const client = getOpenAIClient();

    const response = await client.responses.create({
        model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
        store: false,
        instructions: [
            "You are DynaStay's helpful property-platform assistant.",
            "Answer clearly, politely, and concisely.",
            "You do not have access to live DynaStay listings, bookings, parking inventory, or account records yet.",
            "Never claim that you searched the database, checked availability, or changed a booking.",
            "If a user asks for live property or booking information, explain that this capability is not connected yet."
        ].join(" "),
        input: normalizedMessage,
        max_output_tokens: 500
    });

    const reply = response.output_text;

    if (typeof reply !== "string" || !reply.trim()) {
        throw new Error("AI provider returned an empty response.");
    }

    return reply.trim();
}

module.exports = {
    generateChatReply,
    MAX_MESSAGE_LENGTH
};
