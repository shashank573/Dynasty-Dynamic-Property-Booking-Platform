require("dotenv").config();

const session = require("express-session");
const mongoose = require("mongoose");
const { MongoStore } = require("connect-mongo");

const express = require("express");
const app = express();
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const ExpressError = require("./utils/ExpressError.js");

const apiRoutes = require("./routes/api.js");

const listings = require("./routes/listing.js");
const reviews = require("./routes/review.js");
const users = require("./routes/user.js");


app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({extended: true}));

const sessionOptions = {
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production"
    }
};

if (process.env.NODE_ENV !== "test") {
    sessionOptions.store = MongoStore.create({
        mongoUrl: process.env.MONGO_URL,
        collectionName: "sessions",
        ttl: 24 * 60 * 60
    });
}

app.use(session(sessionOptions));

// Make the logged-in user available to EJS templates
app.use(async (req, res, next) => {
    try {
        res.locals.currentUser = null;

        if (req.session.userId) {
            const User = require("./models/user.js");

            res.locals.currentUser = await User.findById(
                req.session.userId
            );
        }

        next();
    } catch (err) {
        next(err);
    }
});


app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));

app.engine("ejs", ejsMate);


// ROOT ROUTE
app.get("/", (req, res) => {
    res.send("Hi, iam root");
});

// app.get("/testListing", async (req, res) => {
//     let sampleListing = new Listing({
//         title:" My Home",
//         description: "By the beach",
//         price: 1200,
//         location: "Calangute, Goa",
//         country: "India",
//     });

//     await sampleListing.save().then((res) => {
//         console.log(res);
//     }).catch((err)=>console.log(err));

//     res.send("Successful Testing!");
// });

app.use("/api", apiRoutes);


// API health check
app.get("/api/health", (req, res) => {
    const dbConnected = mongoose.connection.readyState === 1;

    res.status(dbConnected ? 200 : 503).json({
        success: dbConnected,
        message: dbConnected
            ? "DynaStay API is healthy"
            : "Database is not connected",
        database: dbConnected ? "connected" : "disconnected"
    });
});


// CRUD ROUTES

//LISTINGS
app.use("/listings", listings);//router 


// REVIEWS
app.use("/listings/:id/reviews", reviews);//router 

//USERS
app.use("/", users);


app.all("/{*splat}", (req, res, next) => {
    next(new ExpressError(404, "page not found"));
});

app.use((err, req, res, next) => {
    let {statusCode = 500, message = "Something Went Wrong!"} = err;

    res.status(statusCode).render("listings/error.ejs",{err});
    // res.status(statusCode).send(message);
    // next(err);
});

module.exports = app;