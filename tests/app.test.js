const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../app");

test("GET / returns the root response", async () => {
    const response = await request(app).get("/");

    assert.equal(response.status, 200);
    assert.equal(response.text, "Hi, iam root");
});

test("GET /listings/new renders the new listing form", async () => {
    const response = await request(app).get("/listings/new");

    assert.equal(response.status, 200);
    assert.match(response.text, /title/i);
});

test("POST /listings rejects invalid listing data", async () => {
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

    assert.equal(response.status, 400);
});