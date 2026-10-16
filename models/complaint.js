const mongoose = require("mongoose");

const complaintSchema = new mongoose.Schema({
    complainant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    booking: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Booking",
        default: null,
        index: true
    },
    category: {
        type: String,
        enum: ["Booking", "Parking", "Property", "Host", "Guest", "Payment", "Safety", "Other"],
        required: true,
        trim: true
    },
    subject: {
        type: String,
        required: true,
        trim: true,
        minlength: 5,
        maxlength: 120
    },
    description: {
        type: String,
        required: true,
        trim: true,
        minlength: 10,
        maxlength: 3000
    },
    status: {
        type: String,
        enum: ["Open", "In Review", "Resolved", "Rejected"],
        default: "Open",
        index: true
    },
    adminNote: {
        type: String,
        trim: true,
        maxlength: 2000,
        default: ""
    },
    handledBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    handledAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });

complaintSchema.index({ complainant: 1, createdAt: -1 });

module.exports = mongoose.model("Complaint", complaintSchema);
