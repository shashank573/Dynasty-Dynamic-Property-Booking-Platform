
const test = require("node:test");
const assert = require("node:assert/strict");

const Listing = require("../models/listing");

const {
    connectToTestDB,
    clearTestDB,
    closeTestDB
} = require("./db-setup");

test("Listing model CRUD operations", async (t) => {
    await connectToTestDB();

    try {
        await t.test("creates a listing", async () => {
            const listing = await Listing.create({
                title: "Test Stay",
                description: "A temporary listing for automated tests",
                price: 1200,
                location: "Dehradun",
                country: "India"
            });

            assert.ok(listing._id);
            assert.equal(listing.title, "Test Stay");
            assert.equal(listing.price, 1200);
        });

        await clearTestDB();

        await t.test("reads a listing by ID", async () => {
            const created = await Listing.create({
                title: "Read Test Stay",
                description: "Testing database read",
                price: 1500,
                location: "Dehradun",
                country: "India"
            });

            const found = await Listing.findById(created._id);

            assert.ok(found);
            assert.equal(found.title, "Read Test Stay");
        });

        await clearTestDB();

        await t.test("updates a listing", async () => {
            const created = await Listing.create({
                title: "Original Stay",
                description: "Testing database update",
                price: 1000,
                location: "Dehradun",
                country: "India"
            });

            const updated = await Listing.findByIdAndUpdate(
                created._id,
                { title: "Updated Stay" },
                { returnDocument: "after", runValidators: true }
            );

            assert.ok(updated);
            assert.equal(updated.title, "Updated Stay");
        });

        await clearTestDB();

        await t.test("deletes a listing", async () => {
            const created = await Listing.create({
                title: "Delete Test Stay",
                description: "Testing database delete",
                price: 900,
                location: "Dehradun",
                country: "India"
            });

            const deleted = await Listing.findByIdAndDelete(created._id);
            const found = await Listing.findById(created._id);

            assert.ok(deleted);
            assert.equal(found, null);
        });
    } finally {
        await closeTestDB();
    }
});