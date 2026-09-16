const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const listingSchema = new Schema({
    title: {
        type: String,
        required: true
    },

    description: String,

    image: {
        type: String,
        default: "https://images.unsplash.com/photo-1552733407-5d5c46c3bb3b?auto=format&fit=crop&w=800&q=60",
        set: (v) =>
            v === ""
                ? "https://images.unsplash.com/photo-1552733407-5d5c46c3bb3b?auto=format&fit=crop&w=800&q=60"
                : v
    },

    price: Number,
    location: String,
    country: String
});

const Listing = mongoose.model("Listing", listingSchema);

// Exporting into app.js
module.exports = Listing;
