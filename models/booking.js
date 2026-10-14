
const mongoose = require("mongoose");

const { Schema } = mongoose;

const bookingSchema = new Schema(
    {
        guest: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        unit: {
            type: Schema.Types.ObjectId,
            ref: "Unit",
            required: true,
            index: true
        },

        checkIn: {
            type: Date,
            required: true
        },

        checkOut: {
            type: Date,
            required: true,
            validate: {
                validator: function (value) {
                    return (
                        this.checkIn instanceof Date &&
                        !Number.isNaN(this.checkIn.getTime()) &&
                        value instanceof Date &&
                        !Number.isNaN(value.getTime()) &&
                        value > this.checkIn
                    );
                },
                message: "Check-out must be after check-in."
            }
        },

        totalPrice: {
            type: Number,
            required: true,
            min: 0
        },

        status: {
            type: String,
            enum: [
                "Pending",
                "Confirmed",
                "Cancelled",
                "Completed"
            ],
            default: "Pending"
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Booking", bookingSchema);
