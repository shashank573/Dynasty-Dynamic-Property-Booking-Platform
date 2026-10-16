const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../app");
const User = require("../models/user");
const Listing = require("../models/listing");
const Parking = require("../models/parking");
const ParkingReservation = require("../models/parkingReservation");
const { connectToTestDB, clearTestDB, closeTestDB } = require("./db-setup");

test("Parking reservation route integration tests", async (t) => {
    await connectToTestDB();
    try {
        await clearTestDB();
        const guest = await User.create({
            name: "Parking Test Guest", email: "parking.guest@example.com",
            password: "TestPassword123", role: "Guest"
        });
        const host = await User.create({
            name: "Parking Test Host", email: "parking.host@example.com",
            password: "TestPassword123", role: "Host"
        });
        const listing = await Listing.create({
            title: "Parking Test Stay", description: "Parking test",
            price: 1000, location: "Dehradun", country: "India", owner: host._id
        });
        const slot = await Parking.create({
            listing: listing._id, slotNumber: "A-01",
            pricePerHour: 20, pricePerDay: 150
        });
        const agent = request.agent(app);
        const login = await agent.post("/login").type("form").send({
            email: guest.email, password: "TestPassword123"
        });
        assert.equal(login.status, 302);

        await t.test("requires login for parking availability", async () => {
            const response = await request(app).get("/parking/availability")
                .query({ listingId: listing._id.toString(), startAt: "2026-11-10T10:00:00Z", endAt: "2026-11-10T12:00:00Z" });
            assert.equal(response.status, 302);
        });

        await t.test("returns available slots for a valid time range", async () => {
            const response = await agent.get("/parking/availability").query({
                listingId: listing._id.toString(),
                startAt: "2026-11-10T10:00:00Z", endAt: "2026-11-10T12:00:00Z"
            });
            assert.equal(response.status, 200);
            assert.equal(response.body.slots.length, 1);
            assert.equal(response.body.slots[0].slotNumber, "A-01");
        });

        await t.test("creates independent hourly reservation with server-calculated price", async () => {
            const response = await agent.post("/parking/reservations").send({
                listingId: listing._id.toString(), parkingId: slot._id.toString(),
                startAt: "2026-11-10T10:00:00Z", endAt: "2026-11-10T12:00:00Z",
                billingUnit: "hour"
            });
            assert.equal(response.status, 201);
            assert.equal(response.body.reservation.totalPrice, 40);
            assert.equal(response.body.reservation.reservationType, "independent");
        });

        await t.test("rejects overlapping reservation and preserves existing booking", async () => {
            const response = await agent.post("/parking/reservations").send({
                listingId: listing._id.toString(), parkingId: slot._id.toString(),
                startAt: "2026-11-10T11:00:00Z", endAt: "2026-11-10T13:00:00Z",
                billingUnit: "hour"
            });
            assert.equal(response.status, 409);
            assert.equal(await ParkingReservation.countDocuments({ status: "Confirmed" }), 1);
        });

        await t.test("lists only the current guest's reservations and allows cancellation", async () => {
            const list = await agent.get("/parking/reservations/mine");
            assert.equal(list.status, 200);
            assert.equal(list.body.reservations.length, 1);
            const id = list.body.reservations[0]._id;
            const cancelled = await agent.patch(`/parking/reservations/${id}/cancel`);
            assert.equal(cancelled.status, 200);
            assert.equal(cancelled.body.reservation.status, "Cancelled");
        });

        await t.test("rejects invalid time ranges", async () => {
            const response = await agent.post("/parking/reservations").send({
                listingId: listing._id.toString(), startAt: "2026-11-10T12:00:00Z",
                endAt: "2026-11-10T10:00:00Z", billingUnit: "hour"
            });
            assert.equal(response.status, 400);
        });
    } finally {
        await closeTestDB();
    }
});
