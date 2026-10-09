const mongoose = require("mongoose");
const express = require("express");
const router = express.Router();

const Listing = require("../models/listing.js");
const wrapAsync = require("../utils/wrapAsync.js");

// GET all listings
router.get("/listings", wrapAsync(async (req, res) => {
    const listings = await Listing.find();

    res.status(200).json({
        success: true,
        count: listings.length,
        data: listings
    });
}));


// GET one listing by ID
router.get("/listings/:id", wrapAsync(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
            success: false,
            message: "Invalid listing ID"
        });
    }

    const listing = await Listing.findById(id);

    if (!listing) {
        return res.status(404).json({
            success: false,
            message: "Listing not found"
        });
    }

    res.status(200).json({
        success: true,
        data: listing
    });
}));

module.exports = router;