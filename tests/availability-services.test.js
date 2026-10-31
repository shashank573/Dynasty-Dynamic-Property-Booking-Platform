const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const User = require("../models/user");
const Listing = require("../models/listing");
const Unit = require("../models/unit");
const Booking = require("../models/booking");
const Parking = require("../models/parking");
const ParkingReservation = require("../models/parkingReservation");

const {
    checkUnitAvailability
} = require("../services/availability/propertyAvailabilityService");
const {
    findAvailableParkingSlots,
    isParkingSlotAvailable
} = require("../services/availability/parkingAvailabilityService");

const {
    connectToTestDB,
    clearTestDB,
    closeTestDB
} = require("./db-setup");

test("Reusable property and parking availability services", async (t) => {
    await connectToTestDB();

    try {
        await clearTestDB();

        const guest = await User.create({
            name: "Availability Test Guest",
            email: "availability.guest@example.com",
            password: "TestPassword123"
        });
        const host = await User.create({
            name: "Availability Test Host",
            email: "availability.host@example.com",
            password: "TestPassword123",
            role: "Host"
        });
        const listing = await Listing.create({
            title: "Availability Test Stay",
            price: 1200,
            location: "Dehradun",
            country: "India",
            owner: host._id
        });
        const unit = await Unit.create({
            listing: listing._id,
            name: "Availability Test Room",
            capacity: 2,
            pricePerNight: 1200
        });
        const disabledUnit = await Unit.create({
            listing: listing._id,
            name: "Disabled Room",
            capacity: 2,
            pricePerNight: 1200,
            isAvailable: false
        });

        const parkingA = await Parking.create({
            listing: listing._id,
            slotNumber: "A-01",
            pricePerHour: 20,
            pricePerDay: 150
        });
        const parkingB = await Parking.create({
            listing: listing._id,
            slotNumber: "A-02",
            pricePerHour: 20,
            pricePerDay: 150
        });
        const inactiveParking = await Parking.create({
            listing: listing._id,
            slotNumber: "A-03",
            pricePerHour: 20,
            pricePerDay: 150,
            isActive: false
        });

        const rangeStart = new Date("2026-11-10T10:00:00.000Z");
        const rangeEnd = new Date("2026-11-10T12:00:00.000Z");

        async function createBooking(status, checkIn = rangeStart, checkOut = rangeEnd) {
            return Booking.create({
                guest: guest._id,
                unit: unit._id,
                checkIn,
                checkOut,
                totalPrice: 2400,
                status
            });
        }

        async function createParkingReservation(parking, status, startAt = rangeStart, endAt = rangeEnd) {
            return ParkingReservation.create({
                guest: guest._id,
                parking: parking._id,
                startAt,
                endAt,
                reservationType: "independent",
                billingUnit: "hour",
                totalPrice: 40,
                status
            });
        }

        await t.test("property service reports an enabled unit with no conflicts as available", async () => {
            const result = await checkUnitAvailability({
                unitId: unit._id,
                start: rangeStart,
                end: rangeEnd
            });

            assert.equal(result.available, true);
            assert.equal(result.reason, null);
            assert.equal(result.unit._id.toString(), unit._id.toString());
        });

        await t.test("property service distinguishes a missing unit", async () => {
            const result = await checkUnitAvailability({
                unitId: new mongoose.Types.ObjectId(),
                start: rangeStart,
                end: rangeEnd
            });

            assert.equal(result.available, false);
            assert.equal(result.reason, "UNIT_NOT_FOUND");
            assert.equal(result.unit, null);
        });

        await t.test("property service rejects a disabled unit", async () => {
            const result = await checkUnitAvailability({
                unitId: disabledUnit._id,
                start: rangeStart,
                end: rangeEnd
            });

            assert.equal(result.available, false);
            assert.equal(result.reason, "UNIT_DISABLED");
        });

        await t.test("Pending and Confirmed property bookings block overlapping dates", async () => {
            for (const status of ["Pending", "Confirmed"]) {
                await Booking.deleteMany({ unit: unit._id });
                await createBooking(status);

                const result = await checkUnitAvailability({
                    unitId: unit._id,
                    start: rangeStart,
                    end: rangeEnd
                });

                assert.equal(result.available, false, status);
                assert.equal(result.reason, "DATE_CONFLICT", status);
            }
        });

        await t.test("Cancelled and Completed property bookings do not block availability", async () => {
            await Booking.deleteMany({ unit: unit._id });
            await createBooking("Cancelled");
            await createBooking("Completed");

            const result = await checkUnitAvailability({
                unitId: unit._id,
                start: rangeStart,
                end: rangeEnd
            });

            assert.equal(result.available, true);
        });

        await t.test("property date intervals allow back-to-back stays", async () => {
            await Booking.deleteMany({ unit: unit._id });
            await createBooking(
                "Confirmed",
                new Date("2026-11-09T10:00:00.000Z"),
                rangeStart
            );

            const result = await checkUnitAvailability({
                unitId: unit._id,
                start: rangeStart,
                end: rangeEnd
            });

            assert.equal(result.available, true);
        });

        await t.test("property service validates IDs and date ranges", async () => {
            await assert.rejects(
                checkUnitAvailability({ unitId: "not-an-object-id", start: rangeStart, end: rangeEnd }),
                TypeError
            );
            await assert.rejects(
                checkUnitAvailability({ unitId: unit._id, start: rangeEnd, end: rangeStart }),
                TypeError
            );
        });

        await t.test("property service supports a caller-provided MongoDB session", async () => {
            const session = await mongoose.startSession();
            try {
                let result;
                await session.withTransaction(async () => {
                    result = await checkUnitAvailability({
                        unitId: unit._id,
                        start: rangeStart,
                        end: rangeEnd,
                        session
                    });
                });
                assert.equal(result.available, true);
            } finally {
                await session.endSession();
            }
        });

        await t.test("parking service reports a free active slot as available", async () => {
            const available = await isParkingSlotAvailable({
                parkingId: parkingA._id,
                start: rangeStart,
                end: rangeEnd
            });
            assert.equal(available, true);
        });

        await t.test("parking service rejects inactive or missing slots", async () => {
            assert.equal(await isParkingSlotAvailable({
                parkingId: inactiveParking._id,
                start: rangeStart,
                end: rangeEnd
            }), false);

            assert.equal(await isParkingSlotAvailable({
                parkingId: new mongoose.Types.ObjectId(),
                start: rangeStart,
                end: rangeEnd
            }), false);
        });

        await t.test("Pending and Confirmed parking reservations block overlapping times", async () => {
            for (const status of ["Pending", "Confirmed"]) {
                await ParkingReservation.deleteMany({ parking: parkingA._id });
                await createParkingReservation(parkingA, status);

                const available = await isParkingSlotAvailable({
                    parkingId: parkingA._id,
                    start: rangeStart,
                    end: rangeEnd
                });
                assert.equal(available, false, status);
            }
        });

        await t.test("Cancelled and Completed parking reservations do not block availability", async () => {
            await ParkingReservation.deleteMany({ parking: parkingA._id });
            await createParkingReservation(parkingA, "Cancelled");
            await createParkingReservation(parkingA, "Completed");

            const available = await isParkingSlotAvailable({
                parkingId: parkingA._id,
                start: rangeStart,
                end: rangeEnd
            });
            assert.equal(available, true);
        });

        await t.test("parking time intervals allow back-to-back reservations", async () => {
            await ParkingReservation.deleteMany({ parking: parkingA._id });
            await createParkingReservation(
                parkingA,
                "Confirmed",
                new Date("2026-11-10T08:00:00.000Z"),
                rangeStart
            );

            const available = await isParkingSlotAvailable({
                parkingId: parkingA._id,
                start: rangeStart,
                end: rangeEnd
            });
            assert.equal(available, true);
        });

        await t.test("bulk parking lookup returns only active slots without overlapping reservations", async () => {
            await ParkingReservation.deleteMany({ parking: { $in: [parkingA._id, parkingB._id] } });
            await createParkingReservation(parkingA, "Confirmed");

            const slots = await findAvailableParkingSlots({
                listingId: listing._id,
                start: rangeStart,
                end: rangeEnd
            });

            assert.deepEqual(
                slots.map(slot => slot.slotNumber),
                ["A-02"]
            );
        });

        await t.test("bulk parking lookup returns an empty list when no active slots exist", async () => {
            const otherListing = await Listing.create({
                title: "No Parking Listing",
                price: 900,
                location: "Dehradun",
                country: "India",
                owner: host._id
            });

            const slots = await findAvailableParkingSlots({
                listingId: otherListing._id,
                start: rangeStart,
                end: rangeEnd
            });

            assert.deepEqual(slots, []);
        });

        await t.test("parking services validate IDs and date ranges", async () => {
            await assert.rejects(
                isParkingSlotAvailable({ parkingId: "invalid", start: rangeStart, end: rangeEnd }),
                TypeError
            );
            await assert.rejects(
                findAvailableParkingSlots({ listingId: "invalid", start: rangeStart, end: rangeEnd }),
                TypeError
            );
            await assert.rejects(
                isParkingSlotAvailable({ parkingId: parkingA._id, start: rangeEnd, end: rangeStart }),
                TypeError
            );
            await assert.rejects(
                findAvailableParkingSlots({ listingId: listing._id, start: rangeEnd, end: rangeStart }),
                TypeError
            );
        });

        await t.test("parking service supports a caller-provided MongoDB session", async () => {
            const session = await mongoose.startSession();
            try {
                let available;
                await session.withTransaction(async () => {
                    available = await isParkingSlotAvailable({
                        parkingId: parkingB._id,
                        start: rangeStart,
                        end: rangeEnd,
                        session
                    });
                });
                assert.equal(available, true);
            } finally {
                await session.endSession();
            }
        });
    } finally {
        await closeTestDB();
    }
});
