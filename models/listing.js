const mongoose = require("mongoose");
const Schema =  mongoose.Schema;
const DEFAULT_IMAGE = "http://images.unsplash.com/photo-1552733407-5d5c46c3bb3b?auto=format&fit=crop&w=800&q=60";


const listingSchema = new Schema({
    title: {
        type : String,
        required : true
    },
    description: String,
    image: {
        type : String,
        default: DEFAULT_IMAGE,
        set: (v) => typeof v === "string" && v.trim() === "" ? DEFAULT_IMAGE : v,
    },
    price: Number,
    location: String,
    country: String,
});

const Listing = mongoose.model("Listing",listingSchema);

//exporting into app.js
module.exports = Listing;