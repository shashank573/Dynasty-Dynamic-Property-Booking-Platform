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

test("App route tests", async (t) => {
    await connectToTestDB();

    try {
        await t.test("GET / returns the root response", async () => {
            const response = await request(app).get("/");

            assert.equal(response.status, 200);
            assert.equal(response.text, "Hi, iam root");
        });

        await t.test("GET /listings/new redirects logged-out users", async () => {
            const response = await request(app).get("/listings/new");

            assert.equal(response.status, 302);
            assert.equal(response.headers.location, "/login");
        });

        await t.test("POST /listings redirects logged-out users", async () => {
            const response = await request(app)
                .post("/listings")
                .type("form")
                .send({
                    "listing[title]": "",
                    "listing[description]": "",
                    "listing[price]": "-1",
                    "listing[country]": "",
                    "listing[location]": ""
                });

            assert.equal(response.status, 302);
            assert.equal(response.headers.location, "/login");
        });
    } finally {
        await closeTestDB();
    }
});
