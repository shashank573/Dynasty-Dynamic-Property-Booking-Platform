const {
    generateChatReply,
    MAX_MESSAGE_LENGTH
} = require("../services/ai/chatService.js");

async function postChatMessage(req, res) {
    const message = req.body && req.body.message;

    if (
        typeof message !== "string" ||
        !message.trim() ||
        message.trim().length > MAX_MESSAGE_LENGTH
    ) {
        return res.status(400).json({
            success: false,
            message: `Message must be a non-empty string of at most ${MAX_MESSAGE_LENGTH} characters.`
        });
    }

    try {
        const reply = await generateChatReply(message);

        return res.status(200).json({
            success: true,
            reply
        });
    } catch (error) {
        if (error.code === "AI_NOT_CONFIGURED") {
            return res.status(503).json({
                success: false,
                message: "The AI assistant is not configured yet."
            });
        }

        if (error instanceof TypeError || error instanceof RangeError) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        // Do not expose provider errors, request details, or secrets to clients.
        return res.status(502).json({
            success: false,
            message: "The AI assistant is temporarily unavailable. Please try again."
        });
    }
}

module.exports = { postChatMessage };
