const mongoose = require("mongoose");
const { Schema } = mongoose;

const parkingReservationSchema = new Schema({
    guest: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    parking: { type: Schema.Types.ObjectId, ref: "Parking", required: true, index: true },
    startAt: { type: Date, required: true },
    endAt: {
        type: Date,
        required: true,
        validate: {
            validator(value) {
                return this.startAt instanceof Date &&
                    !Number.isNaN(this.startAt.getTime()) &&
                    value instanceof Date &&
                    !Number.isNaN(value.getTime()) &&
                    value > this.startAt;
            },
            message: "Reservation end must be after its start."
        }
    },
    reservationType: { type: String, enum: ["property", "independent"], required: true },
    booking: { type: Schema.Types.ObjectId, ref: "Booking", default: null },
    billingUnit: { type: String, enum: ["free", "hour", "day"], required: true },
    totalPrice: { type: Number, min: 0, required: true },
    status: { type: String, enum: ["Pending", "Confirmed", "Cancelled", "Completed"], default: "Confirmed" }
}, { timestamps: true });

parkingReservationSchema.index({ parking: 1, startAt: 1, endAt: 1, status: 1 });
module.exports = mongoose.model("ParkingReservation", parkingReservationSchema);
