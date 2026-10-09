const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../app");
const User = require("../models/user");

const {
connectToTestDB,
clearTestDB,
closeTestDB
} = require("./db-setup");

test("Signup route", async (t) => {
await connectToTestDB();

t.after(async () => {
    await closeTestDB();
});

await t.test("GET /signup renders the signup form", async () => {
    const response = await request(app).get("/signup");

    assert.equal(response.status, 200);
    assert.match(response.text, /Create Your DynaStay Account/);
});

await t.test("POST /signup creates a user and hashes the password", async () => {
    await clearTestDB();

    const response = await request(app)
        .post("/signup")
        .type("form")
        .send({
            name: "Test Guest",
            email: "guest@example.com",
            password: "password123"
        });

    assert.equal(response.status, 302);
    assert.equal(response.headers.location, "/listings");

    const user = await User.findOne({ email: "guest@example.com" });

    assert.ok(user);
    assert.equal(user.name, "Test Guest");
    assert.equal(user.role, "Guest");
    assert.notEqual(user.password, "password123");
    assert.equal(await user.comparePassword("password123"), true);
});

await t.test("POST /signup rejects duplicate email", async () => {
    const response = await request(app)
        .post("/signup")
        .type("form")
        .send({
            name: "Another Guest",
            email: "guest@example.com",
            password: "password456"
        });

    assert.equal(response.status, 409);
});

await t.test("POST /signup rejects a short password", async () => {
    const response = await request(app)
        .post("/signup")
        .type("form")
        .send({
            name: "Short Password",
            email: "short@example.com",
            password: "123"
        });

    assert.equal(response.status, 400);
    assert.equal(
        await User.findOne({ email: "short@example.com" }),
        null
    );
});

await t.test("POST /signup does not allow a public Admin role", async () => {
    await clearTestDB();

    const response = await request(app)
        .post("/signup")
        .type("form")
        .send({
            name: "Untrusted User",
            email: "untrusted@example.com",
            password: "password123",
            role: "Admin"
        });

    assert.equal(response.status, 302);

    const user = await User.findOne({
        email: "untrusted@example.com"
    });

    assert.ok(user);
    assert.equal(user.role, "Guest");
});

});
