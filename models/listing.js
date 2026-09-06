const mongoose = require("mongoose");
const Schema =  mongoose.Schema;


const listingSchema = new Schema({
    title: {
        type : String,
        required : true
    },
    description: String,
    image: {
        type : String,
        // default is for if the image option is not given or image doent exist 
        default: "https://unsplash.com/photos/rock-formations-on-mountain-ridge-sdbq2ozPojI",
        // set is for if the image is not uploaded by the user 
        set:(v)=>  v === ""? "https://unsplash.com/photos/rock-formations-on-mountain-ridge-sdbq2ozPojI" : v,
    },
    price: Number,
    location: String,
    country: String,
});

const Listing = mongoose.model("Listing",listingSchema);

//exporting into app.js
module.exports = Listing;