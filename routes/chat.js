const express = require("express");
const User = require("../models/user.js");
const { postChatMessage } = require("../controllers/chatController.js");
const wrapAsync = require("../utils/wrapAsync.js");

const router = express.Router();

async function requireAuthenticatedUser(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({
            success: false,
            message: "Please log in to use the DynaStay assistant."
        });
    }

    const user = await User.findById(req.session.userId).select("_id role");

    if (!user) {
        return res.status(401).json({
            success: false,
            message: "Your session is no longer valid. Please log in again."
        });
    }

    req.chatUser = user;
    return next();
}

router.post("/", requireAuthenticatedUser, wrapAsync(postChatMessage));

module.exports = router;
