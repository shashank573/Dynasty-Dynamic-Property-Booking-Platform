const express = require("express");
const app = express();
const path = require("path");
const mongoose = require("mongoose");
const methodOverride = require("method-override");
const Listing = require("./models/listing.js");

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({extended: true}));
app.use(methodOverride("_method"));

const MONGO_URL = "mongodb://127.0.0.1:27017/DynaStay";

Main()
.then(()=>{
    console.log("Connections Successful!");
}).catch((err) => console.log(err));

async function Main() {
    await mongoose.connect(MONGO_URL);
}


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

//INDEX ROUTE
app.get("/listings", async (req, res) => {
    const allListings = await Listing.find();
    console.log(allListings);
    res.render("listings/index.ejs", {allListings});
});


//GET & CREATE ROUTE
    // GET
app.get("/listings/new", (req, res) => {
    res.render("listings/newListing.ejs");
});

    // POST
app.post("/listings", async (req, res) => {
    // let {title, description, image, price, location, country} = req.body;
   
    // let newListing = new Listing({
    //     title: title,
    //     description: description,
    //     image: image,
    //     price: price,
    //     location: location,
    //     country: country,
    // });

    let newListing = new Listing(req.body.listing);

    await newListing.save().then((res)=>{
        console.log(res);
    }).catch((err)=>console.log(err));

    res.redirect("/listings");
});


//SHOW ROUTE
app.get("/listings/:id", async (req, res) => {
    let {id} = req.params;
    const listing = await Listing.findById(id);
    res.render("listings/show.ejs", {listing});
})

// EDIT AND UPDATE ROUTE 
    // GET
app.get("/listings/:id/edit", async (req, res) => {
    let {id} = req.params;
    let listing = await Listing.findById(id);
    res.render("listings/edit.ejs", {listing});
});

    // PUT
app.put("/listings/:id", async (req, res) => {
    let {id} = req.params;
    await Listing.findByIdAndUpdate(id, {...req.body.listing});
    res.redirect(`/listings/${id}`); // redirect to show route
});



// DELETE ROUTE
app.delete("/listings/:id", async (req, res) => {
    let {id} = req.params;
    await Listing.findByIdAndDelete(id);
    res.redirect("/listings");
})

app.listen(8080, () => {
    console.log("Server is listening to port 8080");
});