const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../app");
const User = require("../models/user");
const Listing = require("../models/listing");
const Unit = require("../models/unit");
const Booking = require("../models/booking");
const Complaint = require("../models/complaint");
const { connectToTestDB, clearTestDB, closeTestDB } = require("./db-setup");

test("Complaint route integration tests", async (t) => {
    await connectToTestDB();
    try {
        await clearTestDB();
        const guest = await User.create({
            name: "Complaint Guest", email: "complaint.guest@example.com",
            password: "TestPassword123", role: "Guest"
        });
        const otherGuest = await User.create({
            name: "Other Complaint Guest", email: "complaint.other@example.com",
            password: "TestPassword123", role: "Guest"
        });
        const admin = await User.create({
            name: "Complaint Admin", email: "complaint.admin@example.com",
            password: "TestPassword123", role: "Admin"
        });
        const host = await User.create({
            name: "Complaint Host", email: "complaint.host@example.com",
            password: "TestPassword123", role: "Host"
        });
        const listing = await Listing.create({
            title: "Complaint Test Stay", description: "Test listing",
            price: 1000, location: "Dehradun", country: "India", owner: host._id
        });
        const unit = await Unit.create({
            listing: listing._id, name: "Test Unit", capacity: 2,
            pricePerNight: 1000, isAvailable: true
        });
        const booking = await Booking.create({
            guest: guest._id, unit: unit._id,
            checkIn: new Date("2026-12-10T00:00:00Z"),
            checkOut: new Date("2026-12-12T00:00:00Z"),
            totalPrice: 2000, status: "Confirmed"
        });

        const guestAgent = request.agent(app);
        const otherAgent = request.agent(app);
        const adminAgent = request.agent(app);
        const login = async (agent, email) => agent.post("/login").type("form").send({ email, password: "TestPassword123" });
        assert.equal((await login(guestAgent, guest.email)).status, 302);
        assert.equal((await login(otherAgent, otherGuest.email)).status, 302);
        assert.equal((await login(adminAgent, admin.email)).status, 302);

        await t.test("requires login to submit a complaint", async () => {
            const response = await request(app).post("/complaints").send({
                category: "Booking", subject: "Booking issue", description: "I need help with my booking."
            });
            assert.equal(response.status, 302);
            assert.equal(response.headers.location, "/login");
        });

        let complaintId;
        await t.test("submits a complaint and links only the current user's booking", async () => {
            const response = await guestAgent.post("/complaints").send({
                category: "Booking", subject: "Booking issue", description: "I need help with my booking.",
                bookingId: booking._id.toString()
            });
            assert.equal(response.status, 201);
            assert.equal(response.body.success, true);
            assert.equal(response.body.complaint.status, "Open");
            assert.equal(response.body.complaint.booking, booking._id.toString());
            complaintId = response.body.complaint._id;
        });

        await t.test("does not allow linking another guest's booking", async () => {
            const response = await otherAgent.post("/complaints").send({
                category: "Booking", subject: "Booking issue", description: "I need help with my booking.",
                bookingId: booking._id.toString()
            });
            assert.equal(response.status, 404);
            assert.equal(await Complaint.countDocuments({}), 1);
        });

        await t.test("validates complaint input", async () => {
            const response = await guestAgent.post("/complaints").send({
                category: "Unknown", subject: "bad", description: "short"
            });
            assert.equal(response.status, 400);
        });

        await t.test("users can see only their own complaints and not internal admin fields", async () => {
            await Complaint.create({
                complainant: otherGuest._id, category: "Other",
                subject: "Another user issue", description: "This belongs to another user."
            });
            await Complaint.findByIdAndUpdate(complaintId, {
                adminNote: "Private internal note",
                handledBy: admin._id,
                handledAt: new Date()
            });

            const response = await guestAgent.get("/complaints/mine");
            assert.equal(response.status, 200);
            assert.equal(response.body.count, 1);
            assert.equal(response.body.complaints[0].complainant._id, undefined);
            assert.equal(response.body.complaints[0]._id, complaintId);
            assert.equal(Object.hasOwn(response.body.complaints[0], "adminNote"), false);
            assert.equal(Object.hasOwn(response.body.complaints[0], "handledBy"), false);
            assert.equal(Object.hasOwn(response.body.complaints[0], "handledAt"), false);
        });

        await t.test("blocks non-admin access to complaint queue", async () => {
            const response = await guestAgent.get("/complaints");
            assert.equal(response.status, 403);
        });

        await t.test("admin can filter complaints and update status", async () => {
            const list = await adminAgent.get("/complaints").query({ status: "Open" });
            assert.equal(list.status, 200);
            assert.equal(list.body.count, 2);
            const adminComplaint = list.body.complaints.find(item => item._id === complaintId);
            assert.ok(adminComplaint);
            assert.equal(adminComplaint.adminNote, "Private internal note");
            assert.equal(adminComplaint.handledBy._id, admin._id.toString());
            assert.ok(adminComplaint.handledAt);

            const updated = await adminAgent.patch("/complaints/" + complaintId + "/status").send({
                status: "In Review", adminNote: "Reviewing the booking details."
            });
            assert.equal(updated.status, 200);
            assert.equal(updated.body.complaint.status, "In Review");
            assert.equal(updated.body.complaint.adminNote, "Reviewing the booking details.");
            assert.equal(updated.body.complaint.handledBy.toString(), admin._id.toString());
        });

        await t.test("blocks non-admin complaint status changes", async () => {
            const response = await guestAgent.patch("/complaints/" + complaintId + "/status").send({ status: "Resolved" });
            assert.equal(response.status, 403);
        });
    } finally {
        await closeTestDB();
    }
});
