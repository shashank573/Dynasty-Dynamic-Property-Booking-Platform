const test = require("node:test");
const assert = require("node:assert/strict");

const User = require("../models/user");
const Listing = require("../models/listing");
const Unit = require("../models/unit");

const {
    connectToTestDB,
    clearTestDB,
    closeTestDB
} = require("./db-setup");

test("Unit model validation", async (t) => {
    await connectToTestDB();

    try {
        await clearTestDB();

        const user = await User.create({
            name: "Unit Test User",
            email: "unit.test@example.com",
            password: "TestPassword123"
        });

        const listing = await Listing.create({
            title: "Unit Test Stay",
            description: "A listing for unit tests",
            price: 1500,
            location: "Dehradun",
            country: "India",
            owner: user._id
        });

        await t.test("creates a valid unit", async () => {
            const unit = await Unit.create({
                listing: listing._id,
                name: "Deluxe Room",
                description: "A comfortable private room",
                capacity: 2,
                pricePerNight: 1800
            });

            assert.ok(unit._id);
            assert.equal(unit.name, "Deluxe Room");
            assert.equal(unit.capacity, 2);
            assert.equal(unit.pricePerNight, 1800);
            assert.equal(unit.isAvailable, true);
            assert.equal(unit.listing.toString(), listing._id.toString());
        });

        await t.test("rejects a unit without a listing", async () => {
            const unit = new Unit({
                name: "Orphan Room",
                capacity: 2,
                pricePerNight: 1000
            });

            await assert.rejects(
                unit.validate(),
                (error) => error.errors.listing !== undefined
            );
        });

        await t.test("rejects capacity below one", async () => {
            const unit = new Unit({
                listing: listing._id,
                name: "Invalid Room",
                capacity: 0,
                pricePerNight: 1000
            });

            await assert.rejects(
                unit.validate(),
                (error) => error.errors.capacity !== undefined
            );
        });

        await t.test("rejects fractional capacity", async () => {
            const unit = new Unit({
                listing: listing._id,
                name: "Invalid Room",
                capacity: 1.5,
                pricePerNight: 1000
            });

            await assert.rejects(
                unit.validate(),
                (error) => error.errors.capacity !== undefined
            );
        });

        await t.test("rejects a negative nightly price", async () => {
            const unit = new Unit({
                listing: listing._id,
                name: "Invalid Room",
                capacity: 2,
                pricePerNight: -100
            });

            await assert.rejects(
                unit.validate(),
                (error) => error.errors.pricePerNight !== undefined
            );
        });

        await t.test("rejects a unit without a name", async () => {
            const unit = new Unit({
                listing: listing._id,
                capacity: 2,
                pricePerNight: 1000
            });

            await assert.rejects(
                unit.validate(),
                (error) => error.errors.name !== undefined
            );
        });

    } finally {
        await closeTestDB();
    }
});
