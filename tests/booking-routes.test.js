
const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../app");
const User = require("../models/user");
const Listing = require("../models/listing");
const Unit = require("../models/unit");
const Booking = require("../models/booking");
const Parking = require("../models/parking");
const ParkingReservation = require("../models/parkingReservation");

const {
    connectToTestDB,
    clearTestDB,
    closeTestDB
} = require("./db-setup");

test("Booking route integration tests", async (t) => {
    await connectToTestDB();

    try {
        await clearTestDB();

        const guest = await User.create({
            name: "Booking Route Guest",
            email: "booking.route.guest@example.com",
            password: "TestPassword123",
            role: "Guest"
        });

        const host = await User.create({
            name: "Booking Route Host",
            email: "booking.route.host@example.com",
            password: "TestPassword123",
            role: "Host"
        });

        const listing = await Listing.create({
            title: "Booking Route Test Stay",
            description: "Integration test property",
            price: 1500,
            location: "Dehradun",
            country: "India",
            owner: host._id
        });

        const unit = await Unit.create({
            listing: listing._id,
            name: "Test Room",
            capacity: 2,
            pricePerNight: 1500,
            isAvailable: true
        });

        const agent = request.agent(app);

        const loginResponse = await agent
            .post("/login")
            .type("form")
            .send({
                email: guest.email,
                password: "TestPassword123"
            });

        assert.equal(loginResponse.status, 302);

        await t.test(
            "rejects booking when user is not logged in",
            async () => {
                const response = await request(app)
                    .post("/bookings")
                    .type("form")
                    .send({
                        "booking[unit]": unit._id.toString(),
                        "booking[checkIn]": "2026-11-10",
                        "booking[checkOut]": "2026-11-13"
                    });

                assert.equal(response.status, 302);
                assert.equal(response.headers.location, "/login");
            }
        );

        await t.test(
            "creates a booking and calculates price on the server",
            async () => {
                const response = await agent
                    .post("/bookings")
                    .type("form")
                    .send({
                        "booking[unit]": unit._id.toString(),
                        "booking[checkIn]": "2026-11-10",
                        "booking[checkOut]": "2026-11-13",
                    });
                assert.equal(response.status, 201);

                const booking = await Booking.findOne({
                    guest: guest._id,
                    unit: unit._id
                });

                assert.ok(booking);
                assert.equal(booking.totalPrice, 4500);
                assert.equal(
                    booking.guest.toString(),
                    guest._id.toString()
                );
                assert.equal(booking.status, "Pending");
            }
        );

        await t.test(
            "rejects checkout on or before check-in",
            async () => {
                const response = await agent
                    .post("/bookings")
                    .type("form")
                    .send({
                        "booking[unit]": unit._id.toString(),
                        "booking[checkIn]": "2026-11-20",
                        "booking[checkOut]": "2026-11-20"
                    });

                assert.equal(response.status, 400);
            }
        );

        await t.test(
            "rejects past booking dates",
            async () => {
                const response = await agent
                    .post("/bookings")
                    .type("form")
                    .send({
                        "booking[unit]": unit._id.toString(),
                        "booking[checkIn]": "2020-01-10",
                        "booking[checkOut]": "2020-01-13"
                    });

                assert.equal(response.status, 400);
            }
        );

        await t.test(
            "returns 404 when the requested unit does not exist",
            async () => {
                await Booking.deleteMany({});

                // Valid ObjectId, lekin database mein save nahi kiya gaya.
                const nonexistentUnitId = new Unit()._id.toString();

                const response = await agent
                    .post("/bookings")
                    .type("form")
                    .send({
                        "booking[unit]": nonexistentUnitId,
                        "booking[checkIn]": "2026-12-10",
                        "booking[checkOut]": "2026-12-13"
                    });

                assert.equal(response.status, 404);

                const bookings = await Booking.countDocuments({
                    unit: nonexistentUnitId
                });

                assert.equal(bookings, 0);
            }
        );

        await t.test(
            "returns 409 when the requested unit is unavailable",
            async () => {
                await Booking.deleteMany({});

                await Unit.updateOne(
                    { _id: unit._id },
                    { $set: { isAvailable: false } }
                );

                try {
                    const response = await agent
                        .post("/bookings")
                        .type("form")
                        .send({
                            "booking[unit]": unit._id.toString(),
                            "booking[checkIn]": "2026-12-10",
                            "booking[checkOut]": "2026-12-13"
                        });

                    assert.equal(response.status, 409);

                    const bookings = await Booking.countDocuments({
                        unit: unit._id
                    });

                    assert.equal(bookings, 0);
                } finally {
                    await Unit.updateOne(
                        { _id: unit._id },
                        { $set: { isAvailable: true } }
                    );
                }
            }
        );

        await t.test(
            "rejects overlapping confirmed or pending bookings",
            async () => {
                await Booking.deleteMany({});

                await Booking.create({
                    guest: guest._id,
                    unit: unit._id,
                    checkIn: new Date("2026-11-10T00:00:00.000Z"),
                    checkOut: new Date("2026-11-13T00:00:00.000Z"),
                    totalPrice: 4500,
                    status: "Pending"
                });

                const response = await agent
                    .post("/bookings")
                    .type("form")
                    .send({
                        "booking[unit]": unit._id.toString(),
                        "booking[checkIn]": "2026-11-12",
                        "booking[checkOut]": "2026-11-15"
                    });

                assert.equal(response.status, 409);
            }
        );

        await t.test(
            "allows only one of two simultaneous overlapping bookings",
            async () => {
                await Booking.deleteMany({});

                // Doosre guest aur independent login session ko create karo.
                const secondGuest = await User.create({
                    name: "Second Booking Guest",
                    email: "second.booking.guest@example.com",
                    password: "TestPassword123",
                    role: "Guest"
                });

                const secondAgent = request.agent(app);

                const secondLoginResponse = await secondAgent
                    .post("/login")
                    .type("form")
                    .send({
                        email: secondGuest.email,
                        password: "TestPassword123"
                    });

                assert.equal(secondLoginResponse.status, 302);

                const bookingRequest = (bookingAgent) =>
                    bookingAgent
                        .post("/bookings")
                        .type("form")
                        .send({
                            "booking[unit]": unit._id.toString(),
                            "booking[checkIn]": "2026-11-20",
                            "booking[checkOut]": "2026-11-23"
                        });

                // OS - RACE CONDITION TEST:
                // Dono booking requests ko ek saath start karte hain.
                const responses = await Promise.all([
                    bookingRequest(agent),
                    bookingRequest(secondAgent)
                ]);

                const statuses = responses
                    .map((response) => response.status)
                    .sort((a, b) => a - b);

                assert.deepEqual(statuses, [201, 409]);//phle vale ko ok, dusre vale ko error

                const activeBookings = await Booking.countDocuments({
                    unit: unit._id,
                    status: { $in: ["Pending", "Confirmed"] },
                    checkIn: { $lt: new Date("2026-11-23T00:00:00.000Z") },
                    checkOut: { $gt: new Date("2026-11-20T00:00:00.000Z") }
                });

                assert.equal(activeBookings, 1);
            }
        );


        await t.test("automatically assigns free parking with a property booking", async () => {
            await Booking.deleteMany({});
            await ParkingReservation.deleteMany({});
            const slot = await Parking.create({ listing: listing._id, slotNumber: "A-01", pricePerHour: 0, pricePerDay: 0 });
            const response = await agent.post("/bookings").type("form").send({
                "booking[unit]": unit._id.toString(), "booking[checkIn]": "2026-12-20", "booking[checkOut]": "2026-12-23"
            });
            assert.equal(response.status, 201);
            assert.equal(response.body.parking.slotNumber, "A-01");
            const reservation = await ParkingReservation.findOne({ parking: slot._id });
            assert.ok(reservation);
            assert.equal(reservation.reservationType, "property");
            assert.equal(reservation.totalPrice, 0);
            assert.equal(reservation.booking.toString(), response.body.booking.id);
        });

        await t.test("asks guest before proceeding when parking is unavailable", async () => {
            await Booking.deleteMany({});
            await ParkingReservation.deleteMany({});
            const slot = await Parking.findOne({ listing: listing._id });
            await ParkingReservation.create({
                guest: guest._id, parking: slot._id,
                startAt: new Date("2026-12-25T00:00:00.000Z"),
                endAt: new Date("2026-12-28T00:00:00.000Z"),
                reservationType: "independent", billingUnit: "day", totalPrice: 450, status: "Confirmed"
            });
            const response = await agent.post("/bookings").type("form").send({
                "booking[unit]": unit._id.toString(), "booking[checkIn]": "2026-12-25", "booking[checkOut]": "2026-12-28"
            });
            assert.equal(response.status, 409);
            assert.equal(response.body.requiresParkingChoice, true);
            assert.equal(await Booking.countDocuments({ unit: unit._id }), 0);
            assert.equal(await ParkingReservation.countDocuments({ status: "Confirmed" }), 1);
        });

        await t.test("creates property booking without parking after explicit guest choice", async () => {
            const response = await agent.post("/bookings").type("form").send({
                "booking[unit]": unit._id.toString(), "booking[checkIn]": "2026-12-25",
                "booking[checkOut]": "2026-12-28", "booking[parkingChoice]": "without"
            });
            assert.equal(response.status, 201);
            assert.equal(response.body.parking, null);
            assert.equal(await Booking.countDocuments({ unit: unit._id }), 1);
            assert.equal(await ParkingReservation.countDocuments({ status: "Confirmed" }), 1);
        });

    } finally {
        await closeTestDB();
    }
});
