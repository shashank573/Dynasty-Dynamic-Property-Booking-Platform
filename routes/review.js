const express = require("express");
const wrapAsync = require("../utils/wrapAsync.js");
const ExpressError = require("../utils/ExpressError.js");
const { reviewSchema } = require("../schema.js");
const Review = require("../models/reviews.js");
const Listing = require("../models/listing.js");
const { isLoggedIn } = require("../middleware/auth.js");
const router = express.Router({mergeParams: true});


// MIDDLEWARE : VALIDATE FOR SCHEMA
const validateReview = (req, res, next) => {
    let {error} = reviewSchema.validate(req.body); 

    if(error){
        let errMsg = error.details.map((el) => el.message).join(",");
        throw new ExpressError(400, errMsg);
    }else{
        next();
    }
};


//post Review route
router.post("/", isLoggedIn, validateReview, wrapAsync(async(req, res) => {
    let listing = await Listing.findById(req.params.id);
    let newReview = new Review(req.body.review);
    newReview.author = req.session.userId;

    listing.reviews.push(newReview);

    await newReview.save();
    await listing.save();

    console.log("new review saved!");
    res.redirect(`/listings/${listing._id}`);
}));


// Delete Review Route
router.delete("/:reviewId", isLoggedIn, wrapAsync(async (req, res) => {
    let { id, reviewId } = req.params;

    // Find the review
    const review = await Review.findById(reviewId);

    if (!review) {
        return res.status(404).send("Review not found.");
    }

    // Check whether the logged-in user wrote this review
    if (
        !review.author ||
        review.author.toString() !== req.session.userId
    ) {
        return res.status(403).send(
            "You are not allowed to delete this review."
        );
    }

    // Remove review reference from listing
    await Listing.findByIdAndUpdate(id, {
        $pull: { reviews: reviewId }
    });

    // Delete the review itself
    await Review.findByIdAndDelete(reviewId);

    res.redirect(`/listings/${id}`);
}));


module.exports = router;