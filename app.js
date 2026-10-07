const express = require("express");
const app = express();
const path = require("path");
const mongoose = require("mongoose");
const methodOverride = require("method-override");
const Listing = require("./models/listing.js");
const ejsMate = require("ejs-mate");
const wrapAsync = require("./utils/wrapAsync.js");
const ExpressError = require("./utils/ExpressError.js");
const { listingSchema, reviewSchema } = require("./schema.js");
const Review = require("./models/reviews.js");

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({extended: true}));
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));

app.engine("ejs", ejsMate);

const MONGO_URL = "mongodb://127.0.0.1:27017/DynaStay";

Main()
.then(()=>{
    console.log("Connections Successful!");
}).catch((err) => console.log(err));

async function Main() {
    await mongoose.connect(MONGO_URL);
}

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

const validateReview = (req, res, next) => {
    let {error} = reviewSchema.validate(req.body); 

    if(error){
        let errMsg = error.details.map((el) => el.message).join(",");
        throw new ExpressError(400, errMsg);
    }else{
        next();
    }
};

//INDEX ROUTE
app.get("/listings", wrapAsync(async (req, res) => {
    const allListings = await Listing.find();
    // console.log(allListings);
    res.render("listings/index.ejs", {allListings});
}));


//GET & CREATE ROUTE
    // GET
app.get("/listings/new", (req, res) => {
    res.render("listings/newListing.ejs");
});

    // POST
app.post("/listings", validateListing, wrapAsync(async (req, res, next) => {
    // let {title, description, image, price, location, country} = req.body;
   
    // let newListing = new Listing({
    //     title: title,
    //     description: description,
    //     image: image,
    //     price: price,
    //     location: location,
    //     country: country,
    // });

    // let result = listingSchema.validate(req.body); // checks req.body kya validate ho pa rahi hai un sare validations sejo schema mai define kre hai joi ke 
    // console.log(result);

    // if(result.error){
    //     throw new ExpressError(400, result.error);
    // }

    const newListing = new Listing(req.body.listing);
    
    await newListing.save();
    res.redirect("/listings");
}));


//SHOW ROUTE
app.get("/listings/:id", wrapAsync(async (req, res) => {
    let {id} = req.params;
    const listing = await Listing.findById(id).populate("reviews");
    res.render("listings/show.ejs", {listing});
}));



// EDIT AND UPDATE ROUTE 
    // GET
app.get("/listings/:id/edit", wrapAsync(async (req, res) => {
    let {id} = req.params;
    let listing = await Listing.findById(id);
    res.render("listings/edit.ejs", {listing});
}));

    // PUT
app.put("/listings/:id", validateListing, wrapAsync(async (req, res) => {
    // if(!req.body.listing){
    //     throw new ExpressError(400, "Send some valid data for listing");
    // }
    let {id} = req.params;
    await Listing.findByIdAndUpdate(id, {...req.body.listing});
    res.redirect(`/listings/${id}`); // redirect to show route
}));



// DELETE ROUTE
app.delete("/listings/:id", wrapAsync(async (req, res) => {
    let {id} = req.params;
    await Listing.findByIdAndDelete(id); // this will call the post middleware in listingSchema.js and deletes all the reviews associated with this listing
    
    res.redirect("/listings");
}));


// REVIEWS
//post Review route
app.post("/listings/:id/reviews", validateReview, wrapAsync(async(req, res) => {
    let listing = await Listing.findById(req.params.id);
    let newReview = new Review(req.body.review);

    listing.reviews.push(newReview);

    await newReview.save();
    await listing.save();

    console.log("new review saved!");
    res.redirect(`/listings/${listing._id}`);
}));


// Delete Review Route
app.delete("/listings/:id/reviews/:reviewId", wrapAsync(async (req, res) => {
    let {id, reviewId} = req.params;

    await Listing.findByIdAndUpdate(id, {$pull : {reviews : reviewId}});
    await Review.findByIdAndDelete(reviewId);

    res.redirect(`/listings/${id}`)
}));



app.all("/{*splat}", (req, res, next) => {
    next(new ExpressError(404, "page not found"));
});

app.use((err, req, res, next) => {
    let {statusCode = 500, message = "Something Went Wrong!"} = err;

    res.status(statusCode).render("listings/error.ejs",{err});
    // res.status(statusCode).send(message);
    // next(err);
});


app.listen(8080, () => {
    console.log("Server is listening to port 8080");
});