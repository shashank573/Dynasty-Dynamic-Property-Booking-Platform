// Check whether the user is logged in
function isLoggedIn(req, res, next) {
    if (!req.session.userId) {
        return res.redirect("/login");
    }

    next();
}


const Listing = require("../models/listing.js");

// Check whether the logged-in user owns the listing
async function isOwner(req, res, next) {
    try {
        const { id } = req.params;
        const listing = await Listing.findById(id);

        if (!listing) {
            return res.status(404).send("Listing not found.");
        }

        if (listing.owner.toString() !== req.session.userId) {
            return res.status(403).send("You are not allowed to modify this listing.");
        }

        next();
    } catch (err) {
        next(err);
    }
}

module.exports = { isLoggedIn, isOwner };
