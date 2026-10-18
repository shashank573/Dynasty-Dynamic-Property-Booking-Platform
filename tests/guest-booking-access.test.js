const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../app");
const User = require("../models/user");
const Listing = require("../models/listing");
const { connectToTestDB, clearTestDB, closeTestDB } = require("./db-setup");

test("guest-only booking authorization", async () => {
    await connectToTestDB();
    try {
        await clearTestDB();
        const guest = await User.create({
            name: "Guest Access Test", email: "guest-access@example.com",
            password: "TestPassword123", role: "Guest"
        });
        const host = await User.create({
            name: "Host Access Test", email: "host-access@example.com",
            password: "TestPassword123", role: "Host"
        });
        const listing = await Listing.create({
            title: "Access Test Stay", description: "Authorization fixture",
            price: 1000, location: "Dehradun", country: "India", owner: host._id
        });

        const loggedOut = await request(app).post("/bookings").send({});
        assert.equal(loggedOut.status, 302, "logged-out users should be sent to login");

        const hostAgent = request.agent(app);
        const hostLogin = await hostAgent.post("/login").type("form").send({
            email: host.email, password: "TestPassword123"
        });
        assert.equal(hostLogin.status, 302);

        const hostPropertyBooking = await hostAgent.post("/bookings").send({});
        assert.equal(hostPropertyBooking.status, 403, "Host must not create property/unit bookings");

        const hostParkingAvailability = await hostAgent.get("/parking/availability").query({
            listingId: listing._id.toString(),
            startAt: "2027-01-10T10:00:00Z", endAt: "2027-01-10T12:00:00Z"
        });
        assert.equal(hostParkingAvailability.status, 403, "Host must not use guest parking availability flow");

        const hostParkingReservation = await hostAgent.post("/parking/reservations").send({
            listingId: listing._id.toString(),
            startAt: "2027-01-10T10:00:00Z", endAt: "2027-01-10T12:00:00Z",
            billingUnit: "hour"
        });
        assert.equal(hostParkingReservation.status, 403, "Host must not create standalone parking reservations");

        const guestAgent = request.agent(app);
        const guestLogin = await guestAgent.post("/login").type("form").send({
            email: guest.email, password: "TestPassword123"
        });
        assert.equal(guestLogin.status, 302);

        const guestAvailability = await guestAgent.get("/parking/availability").query({
            listingId: listing._id.toString(),
            startAt: "2027-01-10T10:00:00Z", endAt: "2027-01-10T12:00:00Z"
        });
        assert.equal(guestAvailability.status, 200, "Guest should be allowed to check parking availability");

        const guestInvalidBooking = await guestAgent.post("/bookings").send({});
        assert.equal(guestInvalidBooking.status, 400, "Guest reaches booking validation");

        const guestDashboard = await guestAgent.get("/bookings");
        assert.equal(guestDashboard.status, 200);
        assert.match(guestDashboard.text, /My Bookings/);
    } finally {
        await closeTestDB();
    }
});
