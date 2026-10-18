const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const ExpressError = require("../utils/ExpressError.js");
const { listingSchema } = require("../schema.js");
const Listing = require("../models/listing.js");
const Unit = require("../models/unit.js");
const Parking = require("../models/parking.js");
const { isLoggedIn, isOwner, isHostOrAdmin } = require("../middleware/auth.js");

// MIDDLEWARE : VALIDATE FOR SCHEMA
const validateListing = (req, res, next) => {
    let {error} = listingSchema.validate(req.body); 

    if(error){
        let errMsg = error.details.map((el) => el.message).join(",");
        throw new ExpressError(400, errMsg);
    }else{
        next();
    }
};

// INDEX ROUTE
router.get("/", wrapAsync(async (req, res) => {
    const allListings = await Listing.find();
    res.render("listings/index.ejs", {allListings});
}));

// GET & CREATE ROUTE
router.get("/new", isLoggedIn, isHostOrAdmin, (req, res) => {
    res.render("listings/newListing.ejs");
});

// CREATE - POST
router.post("/", isLoggedIn, isHostOrAdmin, validateListing, wrapAsync(async (req, res, next) => {
    const newListing = new Listing(req.body.listing);
    
    newListing.owner = req.session.userId;

    await newListing.save();
    res.redirect("/listings");
}));


// Owner-only UI for managing individual units and parking slots.
router.get("/:id/inventory", isLoggedIn, isOwner, wrapAsync(async (req, res) => {
    const listing = await Listing.findById(req.params.id);
    const [units, parkingSlots] = await Promise.all([
        Unit.find({ listing: listing._id }).sort({ createdAt: -1 }),
        Parking.find({ listing: listing._id }).sort({ slotNumber: 1 })
    ]);
    res.render("listings/inventory.ejs", { listing, units, parkingSlots });
}));

//SHOW ROUTE
router.get("/:id", wrapAsync(async (req, res) => {
    let {id} = req.params;
    const listing = await Listing.findById(id).populate("reviews");
    if (!listing) throw new ExpressError(404, "Listing not found.");
    const [units, parkingSlots] = await Promise.all([
        Unit.find({ listing: id, isAvailable: true }).sort({ pricePerNight: 1 }),
        Parking.find({ listing: id, isActive: true }).select("slotNumber pricePerHour pricePerDay").sort({ slotNumber: 1 })
    ]);
    res.render("listings/show.ejs", { listing, units, parkingSlots });
}));

// EDIT AND UPDATE ROUTE
router.get("/:id/edit", isLoggedIn, isOwner, wrapAsync(async (req, res) => {
    let {id} = req.params;
    let listing = await Listing.findById(id);
    res.render("listings/edit.ejs", {listing});
}));

// PUT
router.put("/:id", isLoggedIn, isOwner, validateListing, wrapAsync(async (req, res) => {
    let {id} = req.params;

    const { owner, ...listingData } = req.body.listing;

    await Listing.findByIdAndUpdate(
        id,
        listingData,
        { runValidators: true }
    );

    res.redirect(`/listings/${id}`);
}));

// DELETE ROUTE
router.delete("/:id", isLoggedIn, isOwner, wrapAsync(async (req, res) => {
    let {id} = req.params;
    await Listing.findByIdAndDelete(id); // this will call the post middleware in listingSchema.js and deletes all the reviews associated with this listing

    res.redirect("/listings");
}));

module.exports = router;