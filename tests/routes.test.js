
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
            password: "TestPassword123",
            role: "Host"
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
        await t.test("Guest cannot create a listing", async () => {
            const guestUser = await User.create({
                name: "Integration Guest",
                email: "integration.guest@example.com",
                password: "TestPassword123",
                role: "Guest"
            });

            const guestAgent = request.agent(app);

            const loginResponse = await guestAgent
                .post("/login")
                .type("form")
                .send({
                    email: "integration.guest@example.com",
                    password: "TestPassword123"
                });

            assert.equal(loginResponse.status, 302);

            const response = await guestAgent
                .post("/listings")
                .type("form")
                .send(validListing);

            assert.equal(response.status, 403);

            const listing = await Listing.findOne({
                title: "Integration Test Stay"
            });

            assert.equal(listing, null);
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
        await t.test(
            "GET /listings/:id/units handles a listing with missing owner",
            async () => {
                const result = await Listing.collection.insertOne({
                    title: "Ownerless Regression Test Listing",
                    description: "Used to test missing-owner protection",
                    price: 1000,
                    country: "India",
                    location: "Dehradun"
                });

                try {
                    const response = await agent.get(
                        `/listings/${result.insertedId}/units`
                    );

                    assert.equal(response.status, 403);
                    assert.equal(
                        response.text,
                        "Listing ownership is not configured."
                    );
                } finally {
                    await Listing.collection.deleteOne({
                        _id: result.insertedId
                    });
                }
            }
        );

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
        await t.test("Another user cannot edit or delete someone else's listing", async () => {
            const listing = await Listing.findOne({
                title: "Updated Integration Stay"
            });

            const anotherUser = await User.create({
                name: "Another Listing User",
                email: "another.listing@example.com",
                password: "TestPassword123",
                role: "Host"
            });

            const anotherAgent = request.agent(app);

            const loginResponse = await anotherAgent
                .post("/login")
                .type("form")
                .send({
                    email: "another.listing@example.com",
                    password: "TestPassword123"
                });

            assert.equal(loginResponse.status, 302);

            const editResponse = await anotherAgent
                .put(`/listings/${listing._id}`)
                .type("form")
                .send({
                    ...validListing,
                    "listing[title]": "Unauthorized Change"
                });

            assert.equal(editResponse.status, 403);

            const deleteResponse = await anotherAgent
                .delete(`/listings/${listing._id}`);

            assert.equal(deleteResponse.status, 403);

            const unchangedListing = await Listing.findById(listing._id);
            assert.equal(unchangedListing.title, "Updated Integration Stay");
        });
        await t.test("Listing update cannot change its owner", async () => {
            const listing = await Listing.findOne({
                title: "Updated Integration Stay"
            });

            const anotherUser = await User.create({
                name: "Ownership Transfer User",
                email: "ownership.transfer@example.com",
                password: "TestPassword123",
                role: "Host"
            });

            const originalOwnerId = listing.owner.toString();

            const response = await agent
                .put(`/listings/${listing._id}`)
                .type("form")
                .send({
                    ...validListing,
                    "listing[title]": "Updated Integration Stay",
                    "listing[owner]": anotherUser._id.toString()
                });

            assert.equal(response.status, 400);

            const updatedListing = await Listing.findById(listing._id);

            assert.equal(updatedListing.owner.toString(), originalOwnerId);
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

        await t.test("Another logged-in user cannot delete someone else's review", async () => {
            const listing = await Listing.findOne({
                title: "Updated Integration Stay"
            });

            const review = await Review.findOne({
                comment: "Excellent stay"
            });

            const anotherUser = await User.create({
                name: "Another Test User",
                email: "another.test@example.com",
                password: "TestPassword123",
                role: "Guest"
            });

            const anotherAgent = request.agent(app);

            const loginResponse = await anotherAgent
                .post("/login")
                .type("form")
                .send({
                    email: "another.test@example.com",
                    password: "TestPassword123"
                });

            assert.equal(loginResponse.status, 302);

            const response = await anotherAgent
                .delete(`/listings/${listing._id}/reviews/${review._id}`);

            assert.equal(response.status, 403);

            // Original review must still exist
            const existingReview = await Review.findById(review._id);
            assert.ok(existingReview);

            // Listing must still reference the review
            const updatedListing = await Listing.findById(listing._id);
            assert.ok(
                updatedListing.reviews.some(
                    (id) => id.equals(review._id)
                )
            );
        });
        await t.test("Cannot delete a review through the wrong listing URL", async () => {
            const originalListing = await Listing.findOne({
                title: "Updated Integration Stay"
        });

        const otherListing = await Listing.create({
            title: "Different Test Stay",
            description: "A separate test property",
            price: 1000,
            country: "India",
            location: "Dehradun",
            owner: testUser._id
        });

        const review = await Review.findOne({
            comment: "Excellent stay"
        });

        const response = await agent
            .delete(
                `/listings/${otherListing._id}/reviews/${review._id}`
            );

        assert.equal(response.status, 403);

        const existingReview = await Review.findById(review._id);
        assert.ok(existingReview);

        const originalListingAfter = await Listing.findById(
            originalListing._id
        );
        assert.ok(
            originalListingAfter.reviews.some(
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
                comment: "Cleanup test",
                author: testUser._id
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