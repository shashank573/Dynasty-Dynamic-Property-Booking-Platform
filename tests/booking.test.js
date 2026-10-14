
const test = require("node:test");
const assert = require("node:assert/strict");

const User = require("../models/user");
const Listing = require("../models/listing");
const Unit = require("../models/unit");
const Booking = require("../models/booking");

const {
    connectToTestDB,
    clearTestDB,
    closeTestDB
} = require("./db-setup");

test("Booking model validation", async (t) => {
    await connectToTestDB();

    try {
        await clearTestDB();

        const guest = await User.create({
            name: "Booking Test Guest",
            email: "booking.guest@example.com",
            password: "TestPassword123"
        });

        const host = await User.create({
            name: "Booking Test Host",
            email: "booking.host@example.com",
            password: "TestPassword123",
            role: "Host"
        });

        const listing = await Listing.create({
            title: "Booking Test Stay",
            price: 1500,
            location: "Dehradun",
            country: "India",
            owner: host._id
        });

        const unit = await Unit.create({
            listing: listing._id,
            name: "Test Room",
            capacity: 2,
            pricePerNight: 1500
        });

        const validBookingData = {
            guest: guest._id,
            unit: unit._id,
            checkIn: new Date("2026-11-10T00:00:00.000Z"),
            checkOut: new Date("2026-11-13T00:00:00.000Z"),
            totalPrice: 4500
        };

        await t.test("creates a valid booking", async () => {
            const booking = await Booking.create(validBookingData);

            assert.ok(booking._id);
            assert.equal(
                booking.guest.toString(),
                guest._id.toString()
            );
            assert.equal(
                booking.unit.toString(),
                unit._id.toString()
            );
            assert.equal(booking.totalPrice, 4500);
            assert.equal(booking.status, "Pending");
        });

        await t.test("rejects a booking without a guest", async () => {
            const booking = new Booking({
                ...validBookingData,
                guest: undefined
            });

            await assert.rejects(
                booking.validate(),
                (error) => error.errors.guest !== undefined
            );
        });

        await t.test("rejects a booking without a unit", async () => {
            const booking = new Booking({
                ...validBookingData,
                unit: undefined
            });

            await assert.rejects(
                booking.validate(),
                (error) => error.errors.unit !== undefined
            );
        });

        await t.test("rejects checkout equal to check-in", async () => {
            const booking = new Booking({
                ...validBookingData,
                checkOut: validBookingData.checkIn
            });

            await assert.rejects(
                booking.validate(),
                (error) => error.errors.checkOut !== undefined
            );
        });

        await t.test("rejects checkout before check-in", async () => {
            const booking = new Booking({
                ...validBookingData,
                checkOut: new Date("2026-11-09T00:00:00.000Z")
            });

            await assert.rejects(
                booking.validate(),
                (error) => error.errors.checkOut !== undefined
            );
        });

        await t.test("rejects a negative total price", async () => {
            const booking = new Booking({
                ...validBookingData,
                totalPrice: -100
            });

            await assert.rejects(
                booking.validate(),
                (error) => error.errors.totalPrice !== undefined
            );
        });

        await t.test("rejects an unsupported status", async () => {
            const booking = new Booking({
                ...validBookingData,
                status: "Booked"
            });

            await assert.rejects(
                booking.validate(),
                (error) => error.errors.status !== undefined
            );
        });

    } finally {
        await closeTestDB();
    }
});
