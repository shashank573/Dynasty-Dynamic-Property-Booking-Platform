const mongoose = require("mongoose");

const { Schema } = mongoose;

const unitSchema = new Schema(
    {
        listing: {
            type: Schema.Types.ObjectId,
            ref: "Listing",
            required: true,
            index: true
        },

        name: {
            type: String,
            required: true,
            trim: true
        },

        description: {
            type: String,
            trim: true,
            default: ""
        },

        capacity: {
            type: Number,
            required: true,
            min: 1,
            validate: {
                validator: Number.isInteger,
                message: "Capacity must be a whole number."
            }
        },

        pricePerNight: {
            type: Number,
            required: true,
            min: 0
        },

        isAvailable: {
            type: Boolean,
            default: true
        },
        // OS - CRITICAL SECTION:
        // Same unit ke booking transactions ko shared document write par coordinate karne ke liye counter.
        bookingVersion: {
            type: Number,
            default: 0,
            min: 0,
            validate: {
                validator: Number.isInteger,
                message: "Booking version must be a whole number."
            }
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Unit", unitSchema);
