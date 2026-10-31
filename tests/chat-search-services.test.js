const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const User = require("../models/user");
const Listing = require("../models/listing");
const Unit = require("../models/unit");
const Parking = require("../models/parking");
const ParkingReservation = require("../models/parkingReservation");
const { searchProperties } = require("../services/ai/propertySearchService");
const { searchParkingSpaces } = require("../services/ai/parkingSearchService");
const { executeChatTool, parseAndValidateArguments } = require("../services/ai/chatToolExecutor");
const { chatTools } = require("../services/ai/chatTools");
const { connectToTestDB, clearTestDB, closeTestDB } = require("./db-setup");

test("DynaStay chatbot property and parking search tools", async (t) => {
    await connectToTestDB();
    try {
        await clearTestDB();
        const host = await User.create({
            name: "Search Tool Host",
            email: "search-tool-host@example.com",
            password: "TestPassword123",
            role: "Host"
        });
        const guest = await User.create({
            name: "Search Tool Guest",
            email: "search-tool-guest@example.com",
            password: "TestPassword123",
            role: "Guest"
        });
        const listing = await Listing.create({
            title: "Mountain View Stay",
            description: "A test property.",
            price: 500,
            location: "Dehradun",
            country: "India",
            owner: host._id
        });
        const otherListing = await Listing.create({
            title: "City Budget Stay",
            price: 9000,
            location: "Delhi",
            country: "India",
            owner: host._id
        });
        const matchingUnit = await Unit.create({
            listing: listing._id,
            name: "Family Suite",
            description: "Room for a family.",
            capacity: 4,
            pricePerNight: 2500
        });
        await Unit.create({
            listing: listing._id,
            name: "Disabled Suite",
            capacity: 8,
            pricePerNight: 1000,
            isAvailable: false
        });
        await Unit.create({
            listing: otherListing._id,
            name: "Small Room",
            capacity: 2,
            pricePerNight: 1500
        });
        const freeSlot = await Parking.create({
            listing: listing._id,
            slotNumber: "P-02",
            pricePerHour: 25,
            pricePerDay: 180
        });
        const occupiedSlot = await Parking.create({
            listing: listing._id,
            slotNumber: "P-01",
            pricePerHour: 20,
            pricePerDay: 150
        });
        await Parking.create({
            listing: listing._id,
            slotNumber: "P-03",
            isActive: false,
            pricePerHour: 15,
            pricePerDay: 100
        });
        const startAt = "2026-11-10T10:00:00.000Z";
        const endAt = "2026-11-10T12:00:00.000Z";
        await ParkingReservation.create({
            guest: guest._id,
            parking: occupiedSlot._id,
            startAt: new Date(startAt),
            endAt: new Date(endAt),
            reservationType: "independent",
            billingUnit: "hour",
            totalPrice: 40,
            status: "Confirmed"
        });

        await t.test("property search applies location and actual unit price/capacity filters", async () => {
            const results = await searchProperties({
                location: "dehrad",
                country: "india",
                minPrice: 2000,
                maxPrice: 3000,
                minCapacity: 3,
                limit: 5
            });
            assert.equal(results.length, 1);
            assert.equal(results[0].id, String(listing._id));
            assert.equal(results[0].units.length, 1);
            assert.equal(results[0].units[0].id, String(matchingUnit._id));
            assert.equal(results[0].units[0].pricePerNight, 2500);
            assert.equal(results[0].units[0].capacity, 4);
            assert.equal(Object.hasOwn(results[0], "owner"), false);
        });

        await t.test("property search excludes listings without matching enabled units", async () => {
            const results = await searchProperties({
                location: "Dehradun",
                minPrice: 100,
                maxPrice: 2000
            });
            assert.deepEqual(results, []);
        });


        await t.test("property search finds matches beyond the former 100-listing candidate boundary", async () => {
            const boundaryListings = Array.from({ length: 101 }, (_, index) => ({
                title: "Boundary " + String(index).padStart(3, "0"),
                location: "BoundaryTown",
                country: "India",
                owner: host._id
            }));
            const insertedListings = await Listing.insertMany(boundaryListings);
            const lastListing = insertedListings[100];
            await Unit.create({
                listing: lastListing._id,
                name: "Late Matching Unit",
                capacity: 3,
                pricePerNight: 1800
            });

            const results = await searchProperties({
                location: "BoundaryTown",
                minPrice: 1500,
                maxPrice: 2000,
                minCapacity: 2,
                limit: 1
            });
            assert.equal(results.length, 1);
            assert.equal(results[0].id, String(lastListing._id));
            assert.equal(results[0].units[0].name, "Late Matching Unit");
        });

        await t.test("property search validates price, capacity, limit and text filters", async () => {
            await assert.rejects(searchProperties({ minPrice: 3000, maxPrice: 1000 }), TypeError);
            await assert.rejects(searchProperties({ minCapacity: 2.5 }), TypeError);
            await assert.rejects(searchProperties({ limit: 11 }), TypeError);
            await assert.rejects(searchProperties({ location: "   " }), TypeError);
        });

        await t.test("parking search returns only active slots free for the requested interval", async () => {
            const result = await searchParkingSpaces({ listingId: String(listing._id), startAt, endAt });
            assert.equal(result.listing.id, String(listing._id));
            assert.equal(result.slots.length, 1);
            assert.equal(result.slots[0].id, String(freeSlot._id));
            assert.equal(result.slots[0].slotNumber, "P-02");
            assert.equal(Object.hasOwn(result.slots[0], "bookingVersion"), false);
        });

        await t.test("parking search validates IDs, ranges and listing existence", async () => {
            await assert.rejects(
                searchParkingSpaces({ listingId: "invalid", startAt, endAt }),
                TypeError
            );
            await assert.rejects(
                searchParkingSpaces({ listingId: String(listing._id), startAt: endAt, endAt: startAt }),
                TypeError
            );
            await assert.rejects(
                searchParkingSpaces({
                    listingId: String(listing._id),
                    startAt: "2026-11-10T10:00:00",
                    endAt: "2026-11-10T12:00:00"
                }),
                TypeError
            );
            await assert.rejects(
                searchParkingSpaces({
                    listingId: String(listing._id),
                    startAt: "2026-02-30T10:00:00Z",
                    endAt: "2026-03-01T10:00:00Z"
                }),
                TypeError
            );
            await assert.rejects(
                searchParkingSpaces({
                    listingId: String(listing._id),
                    startAt: "2026-11-10T10:00:00+15:00",
                    endAt: "2026-11-10T12:00:00+05:30"
                }),
                TypeError
            );
            await assert.rejects(
                searchParkingSpaces({
                    listingId: String(listing._id),
                    startAt: "not-a-date+05:30",
                    endAt: "2026-11-10T12:00:00Z"
                }),
                TypeError
            );
            await assert.rejects(
                searchParkingSpaces({ listingId: new mongoose.Types.ObjectId().toString(), startAt, endAt }),
                error => error.code === "LISTING_NOT_FOUND"
            );
        });

        await t.test("tool executor enforces the allowlist and validates argument shapes", async () => {
            const validArgs = {
                location: "Dehradun",
                country: null,
                minPrice: null,
                maxPrice: null,
                minCapacity: null,
                limit: null
            };
            const result = await executeChatTool("searchProperties", JSON.stringify(validArgs));
            assert.equal(result.success, true);
            assert.equal(result.properties.length, 1);
            assert.equal((await executeChatTool("unapprovedTool", "{}")).success, false);
            assert.equal((await executeChatTool("searchProperties", "{invalid")).success, false);
            assert.equal((await executeChatTool("searchProperties", JSON.stringify({
                ...validArgs,
                unexpected: true
            }))).success, false);
            assert.throws(
                () => parseAndValidateArguments("searchParkingSpaces", {
                    listingId: String(listing._id),
                    startAt
                }),
                TypeError
            );
        });

        await t.test("OpenAI definitions expose only the two approved strict search tools", async () => {
            assert.deepEqual(chatTools.map(tool => tool.name), [
                "searchProperties",
                "searchParkingSpaces"
            ]);
            for (const tool of chatTools) {
                assert.equal(tool.type, "function");
                assert.equal(tool.strict, true);
                assert.equal(tool.parameters.additionalProperties, false);
            }
        });
    } finally {
        await closeTestDB();
    }
});
