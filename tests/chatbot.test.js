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

test("AI chat API authentication and request validation", async (t) => {
    await connectToTestDB();

    const previousApiKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

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

        await t.test("returns a safe 503 response when the API key is not configured", async () => {
            const response = await agent
                .post("/api/chat")
                .send({ message: "Hello DynaStay" });

            assert.equal(response.status, 503);
            assert.equal(response.body.success, false);
            assert.match(response.body.message, /not configured/i);
        });
    } finally {
        if (previousApiKey === undefined) {
            delete process.env.OPENAI_API_KEY;
        } else {
            process.env.OPENAI_API_KEY = previousApiKey;
        }
        await closeTestDB();
    }
});
