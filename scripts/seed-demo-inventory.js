require("dotenv").config();
const mongoose = require("mongoose");
const Listing = require("../models/listing");
const Unit = require("../models/unit");
const Parking = require("../models/parking");

const MONGO_URL = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/DynaStay";
const unitTemplates = [
  [{ name: "Standard Room", capacity: 2, priceFactor: 0.75 }, { name: "Deluxe Room", capacity: 2, priceFactor: 1.05 }],
  [{ name: "Queen Room", capacity: 2, priceFactor: 0.85 }, { name: "Family Suite", capacity: 4, priceFactor: 1.4 }],
  [{ name: "Garden View Room", capacity: 2, priceFactor: 1.1 }, { name: "Family Room", capacity: 4, priceFactor: 1.35 }]
];

// Demo-only inventory. Existing inventory is never overwritten or deleted.
// Stable per-listing choices make repeated runs predictable and idempotent.
function hash(value) {
  let result = 0;
  for (const char of String(value)) result = (result * 31 + char.charCodeAt(0)) >>> 0;
  return result;
}

async function seedDemoInventory() {
  await mongoose.connect(MONGO_URL);
  const listings = await Listing.find().select("_id title price").sort({ _id: 1 });
  let unitsAdded = 0;
  let slotsAdded = 0;

  for (const listing of listings) {
    const existingUnits = await Unit.countDocuments({ listing: listing._id });
    if (existingUnits === 0) {
      const template = unitTemplates[hash(listing._id.toString()) % unitTemplates.length];
      const basePrice = Math.max(500, Math.round((Number(listing.price) || 1200) / 50) * 50);
      const docs = template.map((unit, index) => ({
        listing: listing._id,
        name: unit.name,
        description: "Demo inventory — confirm amenities and capacity with the property owner.",
        capacity: unit.capacity,
        pricePerNight: Math.max(300, Math.round(basePrice * unit.priceFactor / 50) * 50),
        isAvailable: true
      }));
      const created = await Unit.insertMany(docs);
      unitsAdded += created.length;
    }

    const existingSlots = await Parking.countDocuments({ listing: listing._id });
    if (existingSlots === 0) {
      const slotCount = 1 + (hash(listing._id.toString() + "-parking") % 3);
      const slots = Array.from({ length: slotCount }, (_, index) => ({
        listing: listing._id,
        slotNumber: "DEMO-P" + String(index + 1).padStart(2, "0"),
        pricePerHour: 0,
        pricePerDay: 0,
        isActive: true
      }));
      const created = await Parking.insertMany(slots);
      slotsAdded += created.length;
    }
  }

  console.log("Demo inventory seed complete:", { listings: listings.length, unitsAdded, slotsAdded });
  console.log("Reminder: these are demo records; verify prices, capacities, amenities and parking before real use.");
}

seedDemoInventory()
  .catch(error => { console.error("Demo inventory seed failed:", error); process.exitCode = 1; })
  .finally(async () => { await mongoose.disconnect(); });
