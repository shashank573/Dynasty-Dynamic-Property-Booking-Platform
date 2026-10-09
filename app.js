const express = require("express");
const app = express();
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const ExpressError = require("./utils/ExpressError.js");


const listings = require("./routes/listing.js");
const reviews = require("./routes/review.js");


app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({extended: true}));
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



// CRUD ROUTES

//LISTINGS
app.use("/listings", listings);//router 


// REVIEWS
app.use("/listings/:id/reviews", reviews);//router 



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