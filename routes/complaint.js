const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const Complaint = require("../models/complaint.js");
const Booking = require("../models/booking.js");
const User = require("../models/user.js");
const { isLoggedIn } = require("../middleware/auth.js");
const wrapAsync = require("../utils/wrapAsync.js");

const categories = ["Booking", "Parking", "Property", "Host", "Guest", "Payment", "Safety", "Other"];
const statuses = ["Open", "In Review", "Resolved", "Rejected"];

async function isAdmin(req, res, next) {
    const user = await User.findById(req.session.userId).select("role");
    if (!user) return res.status(401).json({ success: false, message: "Please log in first." });
    if (user.role !== "Admin") return res.status(403).json({ success: false, message: "Admin access required." });
    next();
}

// A logged-in guest/host can submit a complaint. If linked to a booking, it must be their own.
router.post("/", isLoggedIn, wrapAsync(async (req, res) => {
    const { category, subject, description, bookingId } = req.body || {};

    if (!categories.includes(category) ||
        typeof subject !== "string" || subject.trim().length < 5 || subject.trim().length > 120 ||
        typeof description !== "string" || description.trim().length < 10 || description.trim().length > 3000) {
        return res.status(400).json({
            success: false,
            message: "Provide a valid category, a subject (5–120 characters), and a description (10–3000 characters)."
        });
    }

    let booking = null;
    if (bookingId !== undefined && bookingId !== null && bookingId !== "") {
        if (typeof bookingId !== "string" || !mongoose.isValidObjectId(bookingId)) {
            return res.status(400).json({ success: false, message: "Invalid booking ID." });
        }
        booking = await Booking.findOne({ _id: bookingId, guest: req.session.userId }).select("_id");
        if (!booking) {
            return res.status(404).json({ success: false, message: "Booking not found for this account." });
        }
    }

    const complaint = await Complaint.create({
        complainant: req.session.userId,
        booking: booking ? booking._id : null,
        category,
        subject: subject.trim(),
        description: description.trim()
    });

    return res.status(201).json({ success: true, message: "Complaint submitted.", complaint });
}));

// Users can view only their own complaints.
router.get("/mine", isLoggedIn, wrapAsync(async (req, res) => {
    const complaints = await Complaint.find({ complainant: req.session.userId })
        .select("-adminNote -handledBy -handledAt")
        .populate("booking", "checkIn checkOut status")
        .sort({ createdAt: -1 });
    return res.status(200).json({ success: true, count: complaints.length, complaints });
}));

// Admin-only queue.
router.get("/", isLoggedIn, isAdmin, wrapAsync(async (req, res) => {
    const filter = {};
    if (req.query.status !== undefined) {
        if (!statuses.includes(req.query.status)) {
            return res.status(400).json({ success: false, message: "Invalid complaint status filter." });
        }
        filter.status = req.query.status;
    }
    const complaints = await Complaint.find(filter)
        .populate("complainant", "name email role")
        .populate("booking", "checkIn checkOut status")
        .populate("handledBy", "name email")
        .sort({ createdAt: -1 });
    return res.status(200).json({ success: true, count: complaints.length, complaints });
}));

// Admin can change complaint status and add an internal note.
router.patch("/:id/status", isLoggedIn, isAdmin, wrapAsync(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ success: false, message: "Invalid complaint ID." });
    }
    const { status, adminNote } = req.body || {};
    if (!statuses.includes(status) ||
        (adminNote !== undefined &&
            (typeof adminNote !== "string" || adminNote.trim().length > 2000))) {
        return res.status(400).json({ success: false, message: "Provide a valid status and an admin note of at most 2000 characters." });
    }
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ success: false, message: "Complaint not found." });

    complaint.status = status;
    if (adminNote !== undefined) {
        complaint.adminNote = adminNote.trim();
    }
    complaint.handledBy = req.session.userId;
    complaint.handledAt = new Date();
    await complaint.save();

    return res.status(200).json({ success: true, message: "Complaint updated.", complaint });
}));

module.exports = router;
