const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../app");
const User = require("../models/user");
const {
    connectToTestDB,
    clearTestDB,
    closeTestDB
} = require("./db-setup");

test("AI chat API authentication, validation, and rate limiting", async (t) => {
    await connectToTestDB();

    const previousApiKey = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;

    try {
        await clearTestDB();

        await t.test("rejects unauthenticated chat requests with JSON 401", async () => {
            const response = await request(app)
                .post("/api/chat")
                .send({ message: "Hello" });

            assert.equal(response.status, 401);
            assert.equal(response.body.success, false);
        });

        const user = await User.create({
            name: "Chat API Test User",
            email: "chat-api-test@example.com",
            password: "TestPassword123",
            role: "Guest"
        });

        const agent = request.agent(app);
        const loginResponse = await agent
            .post("/login")
            .type("form")
            .send({
                email: user.email,
                password: "TestPassword123"
            });

        assert.equal(loginResponse.status, 302);

        await t.test("rejects empty and oversized messages before calling the AI provider", async () => {
            const emptyResponse = await agent
                .post("/api/chat")
                .send({ message: "   " });

            assert.equal(emptyResponse.status, 400);

            const oversizedResponse = await agent
                .post("/api/chat")
                .send({ message: "x".repeat(2001) });

            assert.equal(oversizedResponse.status, 400);
        });

        await t.test("returns a safe 503 response when the OpenRouter key is not configured", async () => {
            const response = await agent
                .post("/api/chat")
                .send({ message: "Hello DynaStay" });

            assert.equal(response.status, 503);
            assert.equal(response.body.success, false);
            assert.match(response.body.message, /not configured/i);
        });

        await t.test("limits each authenticated user to 20 requests per 15-minute window", async () => {
            const limitedUser = await User.create({
                name: "Rate Limit Test User",
                email: "chat-rate-limit@example.com",
                password: "TestPassword123",
                role: "Guest"
            });
            const limitedAgent = request.agent(app);
            const limitedLogin = await limitedAgent
                .post("/login")
                .type("form")
                .send({
                    email: limitedUser.email,
                    password: "TestPassword123"
                });
            assert.equal(limitedLogin.status, 302);

            for (let index = 0; index < 20; index += 1) {
                const response = await limitedAgent
                    .post("/api/chat")
                    .send({ message: "Rate limit check " + index });
                assert.equal(response.status, 503);
                assert.equal(response.headers["ratelimit-limit"], "20");
            }

            const blockedResponse = await limitedAgent
                .post("/api/chat")
                .send({ message: "This request must be rate limited." });
            assert.equal(blockedResponse.status, 429);
            assert.equal(blockedResponse.body.success, false);
            assert.ok(Number(blockedResponse.headers["retry-after"]) > 0);

            const otherUser = await User.create({
                name: "Independent Rate Limit User",
                email: "chat-rate-limit-other@example.com",
                password: "TestPassword123",
                role: "Guest"
            });
            const otherAgent = request.agent(app);
            const otherLogin = await otherAgent
                .post("/login")
                .type("form")
                .send({
                    email: otherUser.email,
                    password: "TestPassword123"
                });
            assert.equal(otherLogin.status, 302);

            const otherUserResponse = await otherAgent
                .post("/api/chat")
                .send({ message: "A separate user's quota." });
            assert.equal(otherUserResponse.status, 503);
        });
    } finally {
        if (previousApiKey === undefined) {
            delete process.env.OPENAI_API_KEY;
        } else {
            process.env.OPENROUTER_API_KEY = previousApiKey;
        }
        await closeTestDB();
    }
});
