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

        await t.test("renders complaint submission, private history, and admin EJS pages with role checks", async () => {
            const newPage = await guestAgent.get("/complaints/new");
            assert.equal(newPage.status, 200);
            assert.match(newPage.text, /Submit a complaint/);
            assert.match(newPage.text, /complaint-form/);
            assert.match(newPage.text, /My complaints/);

            const minePage = await guestAgent.get("/complaints/my");
            assert.equal(minePage.status, 200);
            assert.match(minePage.text, /No complaints yet/);

            const forbiddenAdminPage = await guestAgent.get("/complaints/admin-dashboard");
            assert.equal(forbiddenAdminPage.status, 403);

            const adminPage = await adminAgent.get("/complaints/admin-dashboard");
            assert.equal(adminPage.status, 200);
            assert.match(adminPage.text, /Complaint administration/);
            assert.match(adminPage.text, /admin-status-form/);
        });

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

        await t.test("complainants can edit and delete only their own open complaints", async () => {
            const editableComplaint = await Complaint.create({
                complainant: guest._id, category: "Booking", subject: "Editable complaint",
                description: "This complaint is available for editing."
            });
            const edit = await guestAgent.patch("/complaints/" + editableComplaint._id).send({
                category: "Payment", subject: "Updated payment issue", description: "Updated details for the payment problem."
            });
            assert.equal(edit.status, 200);
            assert.equal(edit.body.success, true);

            const otherUserEdit = await otherAgent.patch("/complaints/" + editableComplaint._id).send({
                category: "Other", subject: "Trying to edit", description: "This should not be allowed."
            });
            assert.equal(otherUserEdit.status, 404);
            const invalidEdit = await guestAgent.patch("/complaints/" + editableComplaint._id).send({
                category: "Unknown", subject: "bad", description: "short"
            });
            assert.equal(invalidEdit.status, 400);
            const deleteAttemptByOther = await otherAgent.delete("/complaints/" + editableComplaint._id);
            assert.equal(deleteAttemptByOther.status, 404);
            const deleteOpen = await guestAgent.delete("/complaints/" + editableComplaint._id);
            assert.equal(deleteOpen.status, 200);
            assert.equal(await Complaint.findById(editableComplaint._id), null);
        });

        await t.test("complaints cannot be edited or deleted after review starts", async () => {
            const reviewedComplaint = await Complaint.create({
                complainant: guest._id, category: "Other", subject: "Reviewed complaint",
                description: "This complaint has entered review."
            });
            reviewedComplaint.status = "In Review";
            await reviewedComplaint.save();
            const edit = await guestAgent.patch("/complaints/" + reviewedComplaint._id).send({
                category: "Other", subject: "Changed complaint", description: "Trying to change reviewed details."
            });
            assert.equal(edit.status, 409);
            const deletion = await guestAgent.delete("/complaints/" + reviewedComplaint._id);
            assert.equal(deletion.status, 409);
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
            assert.equal(Object.hasOwn(response.body.complaints[0], "reopenHistory"), false);
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

            const notePreserved = await adminAgent
                .patch("/complaints/" + complaintId + "/status")
                .send({ status: "In Review" });
            assert.equal(notePreserved.status, 200);
            assert.equal(notePreserved.body.complaint.adminNote, "Private internal note");

            const updated = await adminAgent.patch("/complaints/" + complaintId + "/status").send({
                status: "In Review", adminNote: "Reviewing the booking details."
            });
            assert.equal(updated.status, 200);
            assert.equal(updated.body.complaint.status, "In Review");
            assert.equal(updated.body.complaint.adminNote, "Reviewing the booking details.");
            assert.equal(updated.body.complaint.handledBy.toString(), admin._id.toString());

            const noteCleared = await adminAgent
                .patch("/complaints/" + complaintId + "/status")
                .send({ status: "In Review", adminNote: "" });
            assert.equal(noteCleared.status, 200);
            assert.equal(noteCleared.body.complaint.adminNote, "");
        });

        await t.test("enforces the controlled status transition policy", async () => {
            const policyComplaint = await Complaint.create({
                complainant: guest._id, category: "Other",
                subject: "Transition policy issue", description: "Testing complaint status transitions."
            });
            const directResolve = await adminAgent
                .patch("/complaints/" + policyComplaint._id + "/status")
                .send({ status: "Resolved" });
            assert.equal(directResolve.status, 409);

            const inReview = await adminAgent
                .patch("/complaints/" + policyComplaint._id + "/status")
                .send({ status: "In Review" });
            assert.equal(inReview.status, 200);

            const resolved = await adminAgent
                .patch("/complaints/" + policyComplaint._id + "/status")
                .send({ status: "Resolved" });
            assert.equal(resolved.status, 200);
            assert.equal(resolved.body.complaint.status, "Resolved");

            const directReopenViaStatus = await adminAgent
                .patch("/complaints/" + policyComplaint._id + "/status")
                .send({ status: "In Review" });
            assert.equal(directReopenViaStatus.status, 409);

            const reopen = await adminAgent
                .patch("/complaints/" + policyComplaint._id + "/reopen")
                .send({ reason: "Additional evidence needs another review." });
            assert.equal(reopen.status, 200);
            assert.equal(reopen.body.complaint.status, "In Review");
            assert.equal(reopen.body.complaint.reopenHistory.length, 1);
            assert.equal(reopen.body.complaint.reopenHistory[0].previousStatus, "Resolved");
            assert.equal(reopen.body.complaint.reopenHistory[0].reason, "Additional evidence needs another review.");
            assert.equal(reopen.body.complaint.reopenHistory[0].reopenedBy.toString(), admin._id.toString());
            assert.ok(reopen.body.complaint.reopenHistory[0].reopenedAt);

            const rejected = await adminAgent
                .patch("/complaints/" + policyComplaint._id + "/status")
                .send({ status: "Rejected" });
            assert.equal(rejected.status, 200);
            assert.equal(rejected.body.complaint.status, "Rejected");

            const reopenRejected = await adminAgent
                .patch("/complaints/" + policyComplaint._id + "/reopen")
                .send({ reason: "The complainant supplied new supporting details." });
            assert.equal(reopenRejected.status, 200);
            assert.equal(reopenRejected.body.complaint.status, "In Review");
            assert.equal(reopenRejected.body.complaint.reopenHistory.length, 2);
            assert.equal(reopenRejected.body.complaint.reopenHistory[1].previousStatus, "Rejected");
        });

        await t.test("validates reopen reason, complaint existence, and current status", async () => {
            for (const reason of [undefined, null, 123, {}, [], "too short"]) {
                const response = await adminAgent
                    .patch("/complaints/" + complaintId + "/reopen")
                    .send({ reason });
                assert.equal(response.status, 400);
            }

            const invalidId = await adminAgent
                .patch("/complaints/not-a-valid-id/reopen")
                .send({ reason: "A valid enough reason for reopening." });
            assert.equal(invalidId.status, 400);

            const missing = await adminAgent
                .patch("/complaints/507f1f77bcf86cd799439011/reopen")
                .send({ reason: "A valid enough reason for reopening." });
            assert.equal(missing.status, 404);

            const openComplaint = await Complaint.create({
                complainant: guest._id, category: "Other",
                subject: "Still open issue", description: "This complaint is still open."
            });
            const openReopen = await adminAgent
                .patch("/complaints/" + openComplaint._id + "/reopen")
                .send({ reason: "A valid enough reason for reopening." });
            assert.equal(openReopen.status, 409);
        });

        await t.test("only admins can reopen complaints", async () => {
            const response = await guestAgent
                .patch("/complaints/" + complaintId + "/reopen")
                .send({ reason: "A valid enough reason for reopening." });
            assert.equal(response.status, 403);
        });

        await t.test("rejects malformed admin notes and invalid complaint IDs", async () => {
            for (const adminNote of [null, 123, {}, []]) {
                const response = await adminAgent
                    .patch("/complaints/" + complaintId + "/status")
                    .send({ status: "In Review", adminNote });
                assert.equal(response.status, 400);
                assert.equal(response.body.success, false);
            }

            const tooLongNote = await adminAgent
                .patch("/complaints/" + complaintId + "/status")
                .send({ status: "In Review", adminNote: "x".repeat(2001) });
            assert.equal(tooLongNote.status, 400);

            const invalidStatus = await adminAgent
                .patch("/complaints/" + complaintId + "/status")
                .send({ status: "Unknown" });
            assert.equal(invalidStatus.status, 400);

            const invalidId = await adminAgent
                .patch("/complaints/not-a-valid-id/status")
                .send({ status: "Resolved" });
            assert.equal(invalidId.status, 400);
            assert.equal(invalidId.body.success, false);
        });

        await t.test("blocks non-admin complaint status changes", async () => {
            const response = await guestAgent.patch("/complaints/" + complaintId + "/status").send({ status: "Resolved" });
            assert.equal(response.status, 403);
        });
    } finally {
        await closeTestDB();
    }
});
