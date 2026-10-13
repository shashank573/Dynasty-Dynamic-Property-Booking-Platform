// Check whether the user is logged in
function isLoggedIn(req, res, next) {
    if (!req.session.userId) {
        return res.redirect("/login");
    }

    next();
}


const Listing = require("../models/listing.js");


const User = require("../models/user.js");

// Allow only Host and Admin roles
async function isHostOrAdmin(req, res, next) {
    try {
        const user = await User.findById(req.session.userId);

        if (!user) {
            return res.status(401).send("Please log in first.");
        }

        if (!["Host", "Admin"].includes(user.role)) {
            return res.status(403).send(
                "Only Hosts and Admins can create listings."
            );
        }

        next();
    } catch (err) {
        next(err);
    }
}


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

module.exports = { isLoggedIn, isOwner, isHostOrAdmin };