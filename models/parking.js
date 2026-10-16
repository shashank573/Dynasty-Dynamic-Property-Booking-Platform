const mongoose = require("mongoose");
const { Schema } = mongoose;

const parkingSchema = new Schema({
    listing: { type: Schema.Types.ObjectId, ref: "Listing", required: true, index: true },
    slotNumber: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
    pricePerHour: { type: Number, min: 0, default: 0 },
    pricePerDay: { type: Number, min: 0, default: 0 },
    bookingVersion: { type: Number, min: 0, default: 0 }
}, { timestamps: true });

parkingSchema.index({ listing: 1, slotNumber: 1 }, { unique: true });

module.exports = mongoose.model("Parking", parkingSchema);
