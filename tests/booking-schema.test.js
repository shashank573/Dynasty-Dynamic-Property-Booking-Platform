const test = require("node:test");
const assert = require("node:assert/strict");

const { bookingSchema } = require("../schema");

test("Booking request schema validation", async (t) => {
    const validBooking = {
        booking: {
            unit: "507f1f77bcf86cd799439011",
            checkIn: "2026-11-10",
            checkOut: "2026-11-13"
        }
    };

    await t.test("accepts valid booking dates and unit ID", () => {
        const { error } = bookingSchema.validate(validBooking);

        assert.equal(error, undefined);
    });

    await t.test("rejects an invalid calendar check-in date", () => {
        const { error } = bookingSchema.validate({
            booking: {
                ...validBooking.booking,
                checkIn: "2026-02-30"
            }
        });

        assert.ok(error);
    });

    await t.test("rejects an invalid calendar check-out date", () => {
        const { error } = bookingSchema.validate({
            booking: {
                ...validBooking.booking,
                checkOut: "2026-02-30"
            }
        });

        assert.ok(error);
    });

    await t.test("rejects dates in the wrong format", () => {
        const { error } = bookingSchema.validate({
            booking: {
                ...validBooking.booking,
                checkIn: "10-11-2026"
            }
        });

        assert.ok(error);
    });

    await t.test("rejects a missing check-in date", () => {
        const { error } = bookingSchema.validate({
            booking: {
                unit: validBooking.booking.unit,
                checkOut: validBooking.booking.checkOut
            }
        });

        assert.ok(error);
    });

    await t.test("rejects check-out on or before check-in", () => {
        const { error } = bookingSchema.validate({
            booking: {
                ...validBooking.booking,
                checkIn: "2026-11-10",
                checkOut: "2026-11-10"
            }
        });

        assert.ok(error);
    });

    await t.test("rejects an invalid unit ID", () => {
        const { error } = bookingSchema.validate({
            booking: {
                ...validBooking.booking,
                unit: "not-a-valid-object-id"
            }
        });

        assert.ok(error);
    });
});