const mongoose = require("mongoose");

const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 20;
const COLLECTION_NAME = "chat_rate_limits";

let indexPromise;

function getRateLimitCollection() {
    const collection = mongoose.connection.collection(COLLECTION_NAME);
    if (!indexPromise) {
        indexPromise = collection.createIndex(
            { expiresAt: 1 },
            { expireAfterSeconds: 0, name: "chat_rate_limit_expiry" }
        ).catch(error => {
            indexPromise = undefined;
            throw error;
        });
    }
    return { collection, ready: indexPromise };
}

/**
 * MongoDB-backed fixed-window limiter. The atomic increment is shared across
 * application instances, unlike an in-memory counter.
 */
function createChatRateLimiter({ windowMs = WINDOW_MS, maxRequests = MAX_REQUESTS } = {}) {
    if (!Number.isInteger(windowMs) || windowMs < 1000) {
        throw new TypeError("windowMs must be an integer of at least 1000.");
    }
    if (!Number.isInteger(maxRequests) || maxRequests < 1) {
        throw new TypeError("maxRequests must be a positive integer.");
    }

    return async function chatRateLimiter(req, res, next) {
        const userId = req.chatUser && req.chatUser._id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Authentication is required to use the DynaStay assistant."
            });
        }

        const now = Date.now();
        const windowStart = Math.floor(now / windowMs) * windowMs;
        const windowEnd = windowStart + windowMs;
        const key = `${String(userId)}:${windowStart}`;
        const { collection, ready } = getRateLimitCollection();

        await ready;

        try {
            try {
                await collection.updateOne(
                    { _id: key },
                    {
                        $inc: { count: 1 },
                        $setOnInsert: { expiresAt: new Date(windowEnd + windowMs) }
                    },
                    { upsert: true }
                );
            } catch (error) {
                // Concurrent first requests can race on the unique _id upsert.
                if (error.code !== 11000) throw error;
                await collection.updateOne({ _id: key }, { $inc: { count: 1 } });
            }

            const counter = await collection.findOne({ _id: key }, { projection: { count: 1 } });
            const count = counter ? counter.count : maxRequests + 1;
            const remaining = Math.max(0, maxRequests - count);
            const retryAfterSeconds = Math.max(1, Math.ceil((windowEnd - now) / 1000));

            res.set({
                "RateLimit-Limit": String(maxRequests),
                "RateLimit-Remaining": String(remaining),
                "RateLimit-Reset": String(Math.ceil(windowEnd / 1000))
            });

            if (count > maxRequests) {
                res.set("Retry-After", String(retryAfterSeconds));
                return res.status(429).json({
                    success: false,
                    message: "Too many assistant requests. Please try again later."
                });
            }

            return next();
        } catch (error) {
            return next(error);
        }
    };
}

const chatRateLimiter = createChatRateLimiter();

module.exports = {
    chatRateLimiter,
    createChatRateLimiter,
    WINDOW_MS,
    MAX_REQUESTS
};
