const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../app");
const User = require("../models/user");
const Listing = require("../models/listing");
const Unit = require("../models/unit");
const Booking = require("../models/booking");

const {
    connectToTestDB,
    clearTestDB,
    closeTestDB
} = require("./db-setup");

test("Unit route integration tests", async (t) => {
    await connectToTestDB();

    try {
        await clearTestDB();

        const host = await User.create({
            name: "Unit Route Host",
            email: "unit.route.host@example.com",
            password: "TestPassword123",
            role: "Host"
        });

        const otherHost = await User.create({
            name: "Other Unit Host",
            email: "other.unit.host@example.com",
            password: "TestPassword123",
            role: "Host"
        });

        const guest = await User.create({
            name: "Unit Route Guest",
            email: "unit.route.guest@example.com",
            password: "TestPassword123",
            role: "Guest"
        });

        const listing = await Listing.create({
            title: "Unit Route Test Listing",
            description: "Listing for unit route tests",
            price: 1500,
            location: "Dehradun",
            country: "India",
            owner: host._id
        });

        const otherListing = await Listing.create({
            title: "Other Host Listing",
            description: "Listing owned by another host",
            price: 2000,
            location: "Haldwani",
            country: "India",
            owner: otherHost._id
        });

        const unit = await Unit.create({
            listing: listing._id,
            name: "Original Room",
            description: "Original description",
            capacity: 2,
            pricePerNight: 1500,
            isAvailable: true
        });

        const otherUnit = await Unit.create({
            listing: otherListing._id,
            name: "Other Host Room",
            capacity: 3,
            pricePerNight: 2000,
            isAvailable: true
        });

        const hostAgent = request.agent(app);
        const otherHostAgent = request.agent(app);
        const guestAgent = request.agent(app);

        const login = async (agent, user) => {
            const response = await agent
                .post("/login")
                .type("form")
                .send({
                    email: user.email,
                    password: "TestPassword123"
                });

            assert.equal(response.status, 302);
        };

        await login(hostAgent, host);
        await login(otherHostAgent, otherHost);
        await login(guestAgent, guest);

        const baseUrl = `/listings/${listing._id}/units`;

        await t.test("logged-out user cannot create a unit", async () => {
            const response = await request(app)
                .post(baseUrl)
                .type("form")
                .send({
                    "unit[name]": "Unauthorised Room",
                    "unit[capacity]": "2",
                    "unit[pricePerNight]": "1000"
                });

            assert.equal(response.status, 302);
            assert.equal(response.headers.location, "/login");
        });

        await t.test("guest cannot create a unit", async () => {
            const response = await guestAgent
                .post(baseUrl)
                .type("form")
                .send({
                    "unit[name]": "Guest Room",
                    "unit[capacity]": "2",
                    "unit[pricePerNight]": "1000"
                });

            assert.equal(response.status, 403);
        });

        await t.test("listing owner can list units", async () => {
            const response = await hostAgent.get(baseUrl);

            assert.equal(response.status, 200);
            assert.equal(response.body.units.length, 1);
            assert.equal(response.body.units[0].name, "Original Room");
        });

        await t.test("listing owner can create a unit", async () => {
            const response = await hostAgent
                .post(baseUrl)
                .type("form")
                .send({
                    "unit[name]": "New Room",
                    "unit[description]": "A newly created room",
                    "unit[capacity]": "3",
                    "unit[pricePerNight]": "1800"
                });

            assert.equal(response.status, 201);
            assert.equal(response.body.unit.name, "New Room");
            assert.equal(response.body.unit.capacity, 3);
            assert.equal(response.body.unit.pricePerNight, 1800);
            assert.equal(response.body.unit.isAvailable, true);
            assert.equal(
                response.body.unit.listing,
                listing._id.toString()
            );

            const savedUnit = await Unit.findOne({
                listing: listing._id,
                name: "New Room"
            });

            assert.ok(savedUnit);
        });

        await t.test("unit creation rejects invalid capacity and price", async () => {
            const invalidCapacity = await hostAgent
                .post(baseUrl)
                .type("form")
                .send({
                    "unit[name]": "Invalid Capacity Room",
                    "unit[capacity]": "0",
                    "unit[pricePerNight]": "1000"
                });

            assert.equal(invalidCapacity.status, 400);

            const invalidPrice = await hostAgent
                .post(baseUrl)
                .type("form")
                .send({
                    "unit[name]": "Invalid Price Room",
                    "unit[capacity]": "2",
                    "unit[pricePerNight]": "-100"
                });

            assert.equal(invalidPrice.status, 400);
        });

        await t.test("another host cannot modify this listing's units", async () => {
            const response = await otherHostAgent
                .put(`${baseUrl}/${unit._id}`)
                .type("form")
                .send({
                    "unit[name]": "Hijacked Room",
                    "unit[capacity]": "4",
                    "unit[pricePerNight]": "500"
                });

            assert.equal(response.status, 403);

            const unchangedUnit = await Unit.findById(unit._id);
            assert.equal(unchangedUnit.name, "Original Room");
        });

        await t.test("owner cannot update a unit belonging to another listing", async () => {
            const response = await hostAgent
                .put(`${baseUrl}/${otherUnit._id}`)
                .type("form")
                .send({
                    "unit[name]": "Wrong Listing Update",
                    "unit[capacity]": "4",
                    "unit[pricePerNight]": "1000"
                });

            assert.equal(response.status, 404);

            const unchangedUnit = await Unit.findById(otherUnit._id);
            assert.equal(unchangedUnit.name, "Other Host Room");
        });

        await t.test("listing owner can update their unit", async () => {
            const response = await hostAgent
                .put(`${baseUrl}/${unit._id}`)
                .type("form")
                .send({
                    "unit[name]": "Updated Room",
                    "unit[description]": "Updated description",
                    "unit[capacity]": "4",
                    "unit[pricePerNight]": "2200"
                });

            assert.equal(response.status, 200);
            assert.equal(response.body.unit.name, "Updated Room");
            assert.equal(response.body.unit.capacity, 4);
            assert.equal(response.body.unit.pricePerNight, 2200);

            const savedUnit = await Unit.findById(unit._id);
            assert.equal(savedUnit.name, "Updated Room");
        });

        await t.test("unit with booking history cannot be deleted", async () => {
            await Booking.create({
                guest: guest._id,
                unit: unit._id,
                checkIn: new Date("2026-12-10T00:00:00.000Z"),
                checkOut: new Date("2026-12-12T00:00:00.000Z"),
                totalPrice: 4400,
                status: "Cancelled"
            });

            const response = await hostAgent
                .delete(`${baseUrl}/${unit._id}`);

            assert.equal(response.status, 409);

            const savedUnit = await Unit.findById(unit._id);
            assert.ok(savedUnit);

            const savedBooking = await Booking.findOne({ unit: unit._id });
            assert.ok(savedBooking);
        });

        await t.test("unit without booking history can be deleted", async () => {
            const response = await hostAgent
                .delete(`/listings/${otherListing._id}/units/${otherUnit._id}`);

            assert.equal(response.status, 403);

            const otherHostDelete = await otherHostAgent
                .delete(`/listings/${otherListing._id}/units/${otherUnit._id}`);

            assert.equal(otherHostDelete.status, 200);

            const deletedUnit = await Unit.findById(otherUnit._id);
            assert.equal(deletedUnit, null);
        });
    } finally {
        await closeTestDB();
    }
});
