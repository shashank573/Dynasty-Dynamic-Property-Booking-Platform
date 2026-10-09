
const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../app");
const Listing = require("../models/listing");
const Review = require("../models/reviews");
const User = require("../models/user");

const {
    connectToTestDB,
    clearTestDB,
    closeTestDB
} = require("./db-setup");

const agent = request.agent(app);
let testUser;

const validListing = {
    "listing[title]": "Integration Test Stay",
    "listing[description]": "A comfortable test property",
    "listing[price]": "1200",
    "listing[country]": "India",
    "listing[location]": "Dehradun"
};

test("Listing and Review route integration tests", async (t) => {
    await connectToTestDB();

    try {

        await clearTestDB();

        testUser = await User.create({
            name: "Integration Test User",
            email: "integration.test@example.com",
            password: "TestPassword123"
        });

        const loginResponse = await agent
            .post("/login")
            .type("form")
            .send({
                email: "integration.test@example.com",
                password: "TestPassword123"
            });

        assert.equal(loginResponse.status, 302);

        await t.test("GET /listings returns the listings page", async () => {
            const response = await agent.get("/listings");

            assert.equal(response.status, 200);
            assert.match(response.text, /listings/i);
        });

        await t.test("POST /listings creates a listing", async () => {

            const response = await agent
                .post("/listings")
                .type("form")
                .send(validListing);

            assert.equal(response.status, 302);
            assert.equal(response.headers.location, "/listings");

            const listing = await Listing.findOne({
                title: "Integration Test Stay"
            });

            assert.ok(listing);
            assert.equal(listing.price, 1200);
        });

        await t.test("GET /listings/:id shows a listing", async () => {
            const listing = await Listing.findOne({
                title: "Integration Test Stay"
            });

            const response = await agent
                .get(`/listings/${listing._id}`);

            assert.equal(response.status, 200);
            assert.match(response.text, /Integration Test Stay/);
        });

        await t.test("PUT /listings/:id updates a listing", async () => {
            const listing = await Listing.findOne({
                title: "Integration Test Stay"
            });

            const response = await agent
                .put(`/listings/${listing._id}`)
                .type("form")
                .send({
                    ...validListing,
                    "listing[title]": "Updated Integration Stay"
                });

            assert.equal(response.status, 302);
            assert.equal(
                response.headers.location,
                `/listings/${listing._id}`
            );

            const updated = await Listing.findById(listing._id);

            assert.equal(updated.title, "Updated Integration Stay");
        });

        await t.test("POST /listings rejects invalid data", async () => {
            const response = await agent
                .post("/listings")
                .type("form")
                .send({
                    "listing[title]": "",
                    "listing[description]": "",
                    "listing[price]": "-1",
                    "listing[country]": "",
                    "listing[location]": ""
                });

            assert.equal(response.status, 400);
        });

        await t.test("POST review creates and links a review", async () => {
            const listing = await Listing.findOne({
                title: "Updated Integration Stay"
            });

            const response = await agent
                .post(`/listings/${listing._id}/reviews`)
                .type("form")
                .send({
                    "review[rating]": "5",
                    "review[comment]": "Excellent stay"
                });

            assert.equal(response.status, 302);
            assert.equal(
                response.headers.location,
                `/listings/${listing._id}`
            );

            const updatedListing = await Listing.findById(listing._id);
            const review = await Review.findOne({
                comment: "Excellent stay"
            });

            assert.ok(review);
            assert.equal(review.rating, 5);
            assert.ok(
                updatedListing.reviews.some(
                    (id) => id.equals(review._id)
                )
            );
        });

        await t.test("DELETE review removes its record and listing reference", async () => {
            const listing = await Listing.findOne({
                title: "Updated Integration Stay"
            });

            const review = await Review.findOne({
                comment: "Excellent stay"
            });

            const response = await agent
                .delete(`/listings/${listing._id}/reviews/${review._id}`);

            assert.equal(response.status, 302);
            assert.equal(
                response.headers.location,
                `/listings/${listing._id}`
            );

            const deletedReview = await Review.findById(review._id);
            const updatedListing = await Listing.findById(listing._id);

            assert.equal(deletedReview, null);
            assert.equal(
                updatedListing.reviews.some(
                    (id) => id.equals(review._id)
                ),
                false
            );
        });

        await t.test("DELETE listing removes the listing", async () => {
            const listing = await Listing.findOne({
                title: "Updated Integration Stay"
            });

            const response = await agent
                .delete(`/listings/${listing._id}`);

            assert.equal(response.status, 302);
            assert.equal(response.headers.location, "/listings");

            const deletedListing = await Listing.findById(listing._id);

            assert.equal(deletedListing, null);
        });

        await t.test("POST review rejects invalid rating", async () => {
            await clearTestDB();

            const listing = await Listing.create({
                title: "Review Validation Stay",
                description: "Testing review validation",
                price: 1000,
                country: "India",
                location: "Dehradun",
                owner: testUser._id
            });

            const response = await agent
                .post(`/listings/${listing._id}/reviews`)
                .type("form")
                .send({
                    "review[rating]": "8",
                    "review[comment]": "Invalid rating test"
                });

            assert.equal(response.status, 400);

            assert.equal(await Review.countDocuments(), 0);
        });

        await t.test("deleting a listing also deletes its reviews", async () => {
            const listing = await Listing.create({
                title: "Cascade Delete Stay",
                description: "Testing review cleanup",
                price: 900,
                country: "India",
                location: "Dehradun",
                owner: testUser._id
            });

            const review = await Review.create({
                rating: 4,
                comment: "Cleanup test"
            });

            listing.reviews.push(review._id);
            await listing.save();

            await Listing.findByIdAndDelete(listing._id);

            assert.equal(
                await Listing.findById(listing._id),
                null
            );
            assert.equal(
                await Review.findById(review._id),
                null
            );
        });
    } finally {
        await closeTestDB();
    }
});