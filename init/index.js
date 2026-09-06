// INSERTING OUR DATA

const mongoose = require("mongoose");
const initData = require("./data.js");
const Listing = require("../models/listing.js");

const MONGO_URL = "mongodb://127.0.0.1:27017/DynaStay";

Main()
.then(()=>{
    console.log("Connections Successful!");
}).catch((err) => console.log(err));

async function Main() {
    await mongoose.connect(MONGO_URL);
}

const initDB = async () => {
    await Listing.deleteMany({});
    await Listing.insertMany(initData.data); // initData is a object and we want data only
    console.log("data was initialized");
};

initDB();