const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const User = require("../models/user.js");

// Show login form
router.get("/login", (req, res) => {
    res.render("users/login.ejs");
});

// Login an existing user
router.post("/login", async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (
            typeof email !== "string" ||
            typeof password !== "string" ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).send(
                "Email and password are required."
            );
        }

        const normalizedEmail = email.trim().toLowerCase();

        const user = await User.findOne({
            email: normalizedEmail
        });

        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).send(
                "Invalid email or password."
            );
        }

        req.session.regenerate((err) => {
            if (err) {
                return next(err);
            }

            req.session.userId = user._id.toString();

            req.session.save((err) => {
                if (err) {
                    return next(err);
                }

                return res.redirect("/listings");
            });
        });
    } catch (err) {
        next(err);
    }
});


// Show signup form
router.get("/signup", (req, res) => {
res.render("users/signup.ejs");
});

// Register a new user
router.post("/signup", async (req, res, next) => {
try {
const { name, email, password } = req.body;

    if (
        typeof name !== "string" ||
        typeof email !== "string" ||
        typeof password !== "string" ||
        !name.trim() ||
        !email.trim() ||
        password.length < 8
    ) {
        return res.status(400).send(
            "Valid name, email, and a password of at least 8 characters are required."
        );
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
        email: normalizedEmail
    });

    if (existingUser) {
        return res.status(409).send(
            "An account with this email already exists."
        );
    }

    const user = new User({
        name: name.trim(),
        email: normalizedEmail,
        password,
        role: "Guest"
    });

    await user.save();

    req.session.userId = user._id.toString();

    return res.redirect("/listings");
} catch (err) {
    if (err.code === 11000) {
        return res.status(409).send(
            "An account with this email already exists."
        );
    }

    next(err);
}

});


// Logout the current user
router.post("/logout", (req, res, next) => {
    req.session.destroy((err) => {
        if (err) {
            return next(err);
        }

        res.clearCookie("connect.sid");

        return res.redirect("/listings");
    });
});

module.exports = router;