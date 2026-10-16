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

            const repeated = await agent.patch(`/parking/reservations/${id}/cancel`);
            assert.equal(repeated.status, 409);
        });

        await t.test("does not allow cancellation of a completed reservation", async () => {
            const completed = await ParkingReservation.create({
                guest: guest._id,
                parking: slot._id,
                startAt: new Date("2026-10-01T10:00:00Z"),
                endAt: new Date("2026-10-01T12:00:00Z"),
                reservationType: "independent",
                billingUnit: "hour",
                totalPrice: 40,
                status: "Completed"
            });
            const response = await agent.patch(`/parking/reservations/${completed._id}/cancel`);
            assert.equal(response.status, 409);
            assert.equal((await ParkingReservation.findById(completed._id)).status, "Completed");
        });


        await t.test("does not allow another guest to cancel this guest's reservation", async () => {
            const reservation = await ParkingReservation.create({
                guest: guest._id, parking: slot._id,
                startAt: new Date("2026-11-12T10:00:00Z"), endAt: new Date("2026-11-12T12:00:00Z"),
                reservationType: "independent", billingUnit: "hour", totalPrice: 40, status: "Confirmed"
            });
            const otherGuest = await User.create({ name: "Other Parking Guest", email: "other.parking.guest@example.com", password: "TestPassword123", role: "Guest" });
            const otherAgent = request.agent(app);
            const otherLogin = await otherAgent.post("/login").type("form").send({ email: otherGuest.email, password: "TestPassword123" });
            assert.equal(otherLogin.status, 302);
            const response = await otherAgent.patch("/parking/reservations/" + reservation._id + "/cancel");
            assert.equal(response.status, 404);
            assert.equal((await ParkingReservation.findById(reservation._id)).status, "Confirmed");
        });

        await t.test("calculates daily billing on the server", async () => {
            const response = await agent.post("/parking/reservations").send({ listingId: listing._id.toString(), parkingId: slot._id.toString(), startAt: "2026-11-12T10:00:00Z", endAt: "2026-11-13T11:00:00Z", billingUnit: "day" });
            assert.equal(response.status, 201);
            assert.equal(response.body.reservation.totalPrice, 300);
            assert.equal(response.body.reservation.billingUnit, "day");
        });

        await t.test("allows only one of two simultaneous overlapping parking reservations", async () => {
            const startAt = "2026-11-15T10:00:00Z";
            const endAt = "2026-11-15T12:00:00Z";
            const submitReservation = () => agent.post("/parking/reservations").send({ listingId: listing._id.toString(), parkingId: slot._id.toString(), startAt, endAt, billingUnit: "hour" });
            const responses = await Promise.all([submitReservation(), submitReservation()]);
            assert.equal(responses.filter(response => response.status === 201).length, 1);
            assert.equal(responses.filter(response => response.status === 409).length, 1);
            assert.equal(await ParkingReservation.countDocuments({ parking: slot._id, startAt: new Date(startAt), endAt: new Date(endAt), status: { $in: ["Pending", "Confirmed"] } }), 1);
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
