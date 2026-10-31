/**
 * DynaStay demo-data seeder
 *
 * Copy this file to: scripts/seed-demo-data.js
 * Run only against a development/demo database:
 *   ALLOW_DEMO_SEED=true node scripts/seed-demo-data.js
 *
 * Safety:
 * - Does not delete or overwrite existing records.
 * - Uses dedicated *.dynastay.test demo accounts.
 * - Creates related records using actual Mongoose models.
 * - User.create() runs the User save middleware, so passwords are hashed.
 */

require("dotenv").config();
const mongoose = require("mongoose");

const User = require("../models/user");
const Listing = require("../models/listing");
const Unit = require("../models/unit");
const Parking = require("../models/parking");
const Booking = require("../models/booking");
const ParkingReservation = require("../models/parkingReservation");
const Review = require("../models/reviews");
const Complaint = require("../models/complaint");

const MONGO_URL = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/DynaStay";

const demoUsers = [
  { key: "hostA", name: "Aarav Mehta", email: "host.aarav@dynastay.test", password: "HostDemo#2026", role: "Host" },
  { key: "hostB", name: "Ananya Kapoor", email: "host.ananya@dynastay.test", password: "HostDemo#2026", role: "Host" },
  { key: "guestA", name: "Rohan Sharma", email: "guest.rohan@dynastay.test", password: "GuestDemo#2026", role: "Guest" },
  { key: "guestB", name: "Isha Verma", email: "guest.isha@dynastay.test", password: "GuestDemo#2026", role: "Guest" },
  { key: "guestC", name: "Kabir Joshi", email: "guest.kabir@dynastay.test", password: "GuestDemo#2026", role: "Guest" },
  { key: "guestD", name: "Meera Nair", email: "guest.meera@dynastay.test", password: "GuestDemo#2026", role: "Guest" },
  { key: "admin", name: "DynaStay Demo Admin", email: "admin@dynastay.test", password: "AdminDemo#2026", role: "Admin" }
];

const listingTemplates = [
  {
    key: "rishikesh-riverside",
    title: "[DEMO] Pine & Peak Riverside Stay",
    description: "A relaxed riverside stay with mountain views, a shared courtyard and easy access to local cafés. Demo property data; verify all details before real use.",
    image: "https://images.unsplash.com/photo-1449158743715-0a90dea6d2d8?auto=format&fit=crop&w=1200&q=80",
    price: 3200, location: "Rishikesh", country: "India", owner: "hostA",
    units: [
      { name: "Riverside Queen Room", description: "Queen bed, attached bathroom and river-facing balcony.", capacity: 2, min: 2200, max: 3000 },
      { name: "Family Loft", description: "Two sleeping areas, family seating and a mountain-facing window.", capacity: 4, min: 3600, max: 4800 }
    ],
    parkingSlots: 5
  },
  {
    key: "dehradun-courtyard",
    title: "[DEMO] Cedar Courtyard Homestay",
    description: "A quiet city homestay with a garden courtyard, work desk and convenient access to Dehradun markets. Demo property data.",
    image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80",
    price: 2400, location: "Dehradun", country: "India", owner: "hostA",
    units: [
      { name: "Garden View Room", description: "Comfortable double room overlooking the courtyard.", capacity: 2, min: 1500, max: 2200 },
      { name: "Family Studio", description: "Studio layout with a small dining area and extra sleeping space.", capacity: 3, min: 2200, max: 3200 }
    ],
    parkingSlots: 4
  },
  {
    key: "mussoorie-cloudline",
    title: "[DEMO] Cloudline Mountain Retreat",
    description: "A hillside retreat with panoramic mountain views and a shared lounge. This demo listing intentionally has no parking inventory.",
    image: "https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&w=1200&q=80",
    price: 5200, location: "Mussoorie", country: "India", owner: "hostB",
    units: [
      { name: "Mountain View Suite", description: "Private suite with a wide valley-facing window.", capacity: 2, min: 3500, max: 4700 },
      { name: "Panorama Family Suite", description: "Large suite with separate sleeping and sitting areas.", capacity: 4, min: 5200, max: 6900 }
    ],
    parkingSlots: 0
  },
  {
    key: "jaipur-heritage",
    title: "[DEMO] Old Town Heritage House",
    description: "A restored heritage-style home near Jaipur's old city, with traditional décor and a peaceful inner courtyard. Demo listing.",
    image: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=80",
    price: 3800, location: "Jaipur", country: "India", owner: "hostB",
    units: [
      { name: "Heritage Double Room", description: "Double room with handcrafted furniture and attached bathroom.", capacity: 2, min: 2000, max: 2900 },
      { name: "Royal Family Room", description: "Spacious room for families with a separate sitting corner.", capacity: 4, min: 3400, max: 4600 }
    ],
    parkingSlots: 5
  },
  {
    key: "nainital-lakeview",
    title: "[DEMO] Lakeview Workation Apartment",
    description: "A practical apartment for short stays and remote work, with a dedicated desk and lake-facing common terrace. Demo listing.",
    image: "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=80",
    price: 4100, location: "Nainital", country: "India", owner: "hostA",
    units: [
      { name: "Lakeview Studio", description: "Compact studio with a work desk and kitchenette.", capacity: 2, min: 2600, max: 3500 },
      { name: "Two-Bedroom Apartment", description: "Two bedrooms, living room and a full kitchen.", capacity: 4, min: 4300, max: 5600 }
    ],
    parkingSlots: 3
  }
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function utcDateOffset(days, hour = 0) {
  const date = new Date();
  date.setUTCHours(hour, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

async function getOrCreateUser(template) {
  let user = await User.findOne({ email: template.email });
  if (user) {
    if (user.role !== template.role) {
      throw new Error(`Existing ${template.email} has role ${user.role}; expected ${template.role}. No role was changed.`);
    }
    return user;
  }
  // User.create() invokes the schema's save middleware and hashes the password.
  user = await User.create(template);
  return user;
}

async function getOrCreateListing(template, owner) {
  let listing = await Listing.findOne({ title: template.title, owner: owner._id });
  if (listing) return listing;
  return Listing.create({
    title: template.title,
    description: template.description,
    image: template.image,
    price: template.price,
    location: template.location,
    country: template.country,
    owner: owner._id,
    reviews: []
  });
}

async function getOrCreateUnit(template, listing) {
  let unit = await Unit.findOne({ listing: listing._id, name: template.name });
  if (unit) return unit;
  return Unit.create({
    listing: listing._id,
    name: template.name,
    description: template.description,
    capacity: template.capacity,
    pricePerNight: randomInt(template.min, template.max),
    isAvailable: true,
    bookingVersion: 0
  });
}

async function getOrCreateParkingSlot(listing, slotNumber) {
  let slot = await Parking.findOne({ listing: listing._id, slotNumber });
  if (slot) return slot;
  return Parking.create({
    listing: listing._id,
    slotNumber,
    isActive: true,
    pricePerHour: randomInt(20, 40),
    pricePerDay: randomInt(120, 220),
    bookingVersion: 0
  });
}

async function getOrCreateBooking({ guest, unit, startOffset, nights, status }) {
  // The dedicated demo guest + demo unit pair is the idempotency key.
  let booking = await Booking.findOne({ guest: guest._id, unit: unit._id });
  if (booking) return booking;

  const checkIn = utcDateOffset(startOffset);
  const checkOut = utcDateOffset(startOffset + nights);
  return Booking.create({
    guest: guest._id,
    unit: unit._id,
    checkIn,
    checkOut,
    totalPrice: unit.pricePerNight * nights,
    status
  });
}

async function getOrCreateReview(listing, author, comment, rating) {
  let review = await Review.findOne({ author: author._id, comment });
  if (!review) review = await Review.create({ author: author._id, comment, rating });
  if (!listing.reviews.some(id => id.equals(review._id))) {
    listing.reviews.push(review._id);
    await listing.save();
  }
  return review;
}

async function getOrCreateComplaint(data) {
  const existing = await Complaint.findOne({ complainant: data.complainant, subject: data.subject });
  if (existing) return { complaint: existing, created: false };
  const complaint = await Complaint.create(data);
  return { complaint, created: true };
}

async function seedDemoData() {
  if (process.env.ALLOW_DEMO_SEED !== "true") {
    throw new Error("Safety stop: set ALLOW_DEMO_SEED=true only after confirming MONGO_URL points to your development/demo database.");
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Safety stop: demo seeding is disabled when NODE_ENV=production.");
  }

  await mongoose.connect(MONGO_URL);
  const users = {};
  for (const template of demoUsers) users[template.key] = await getOrCreateUser(template);

  const listings = {};
  const units = {};
  const parkingSlots = {};

  for (const template of listingTemplates) {
    const listing = await getOrCreateListing(template, users[template.owner]);
    listings[template.key] = listing;
    units[template.key] = [];

    for (const unitTemplate of template.units) {
      units[template.key].push(await getOrCreateUnit(unitTemplate, listing));
    }

    parkingSlots[template.key] = [];
    for (let index = 1; index <= template.parkingSlots; index += 1) {
      const slotNumber = `DEMO-${template.key.toUpperCase()}-P${String(index).padStart(2, "0")}`;
      parkingSlots[template.key].push(await getOrCreateParkingSlot(listing, slotNumber));
    }
  }

  // Reviews: one demo review per property, linked from Listing.reviews.
  const reviewComments = [
    "DEMO REVIEW: Clean room, helpful host and a smooth check-in.",
    "DEMO REVIEW: Comfortable stay and a convenient location.",
    "DEMO REVIEW: Lovely views; the property details were easy to understand.",
    "DEMO REVIEW: Good value for a short family trip.",
    "DEMO REVIEW: Quiet place with a useful work area."
  ];
  let reviewsAdded = 0;
  for (let index = 0; index < listingTemplates.length; index += 1) {
    const template = listingTemplates[index];
    const before = await Review.countDocuments({ author: users[`guest${["A", "B", "C", "D"][index % 4]}`]._id, comment: reviewComments[index] });
    await getOrCreateReview(
      listings[template.key],
      users[`guest${["A", "B", "C", "D"][index % 4]}`],
      reviewComments[index],
      randomInt(4, 5)
    );
    if (!before) reviewsAdded += 1;
  }

  // Property bookings: future confirmed, completed history, and a cancelled example.
  const bookingA = await getOrCreateBooking({
    guest: users.guestA, unit: units["rishikesh-riverside"][0], startOffset: 35, nights: 2, status: "Confirmed"
  });
  const bookingB = await getOrCreateBooking({
    guest: users.guestB, unit: units["mussoorie-cloudline"][1], startOffset: 50, nights: 3, status: "Confirmed"
  });
  const bookingC = await getOrCreateBooking({
    guest: users.guestC, unit: units["dehradun-courtyard"][0], startOffset: -45, nights: 2, status: "Completed"
  });
  const bookingD = await getOrCreateBooking({
    guest: users.guestD, unit: units["jaipur-heritage"][1], startOffset: 70, nights: 2, status: "Cancelled"
  });

  // Link parking only to the first property booking. The Mussoorie demo property has no slots.
  let propertyParkingAdded = 0;
  if (parkingSlots["rishikesh-riverside"].length) {
    const slot = parkingSlots["rishikesh-riverside"][0];
    const existing = await ParkingReservation.findOne({ booking: bookingA._id, reservationType: "property" });
    if (!existing) {
      await ParkingReservation.create({
        guest: users.guestA._id,
        parking: slot._id,
        startAt: bookingA.checkIn,
        endAt: bookingA.checkOut,
        reservationType: "property",
        booking: bookingA._id,
        billingUnit: "free",
        totalPrice: 0,
        status: "Confirmed"
      });
      propertyParkingAdded += 1;
    }
  }

  // Independent parking reservation: deliberately has no Booking reference.
  let independentParkingAdded = 0;
  const independentSlot = parkingSlots["dehradun-courtyard"][0];
  if (independentSlot) {
    const existing = await ParkingReservation.findOne({
      guest: users.guestD._id,
      parking: independentSlot._id,
      reservationType: "independent"
    });
    if (!existing) {
      const startAt = utcDateOffset(85, 9);
      const endAt = utcDateOffset(85, 13);
      await ParkingReservation.create({
        guest: users.guestD._id,
        parking: independentSlot._id,
        startAt,
        endAt,
        reservationType: "independent",
        booking: null,
        billingUnit: "hour",
        totalPrice: 4 * independentSlot.pricePerHour,
        status: "Confirmed"
      });
      independentParkingAdded += 1;
    }
  }

  // Complaints: linked complaint, unlinked complaint and an admin-reviewed example.
  let complaintsAdded = 0;
  const complaintOne = await getOrCreateComplaint({
    complainant: users.guestA._id,
    booking: bookingA._id,
    category: "Parking",
    subject: "DEMO: Parking direction needs clarification",
    description: "The parking slot was reserved, but the entry direction was not clear. Please add a simple direction note for arriving guests.",
    status: "Open"
  });
  if (complaintOne.created) complaintsAdded += 1;

  const complaintTwo = await getOrCreateComplaint({
    complainant: users.guestC._id,
    booking: bookingC._id,
    category: "Property",
    subject: "DEMO: Room amenities need an update",
    description: "The room description should mention the updated workspace facilities so future guests know what is available.",
    status: "Resolved",
    adminNote: "Demo resolution: property information was reviewed.",
    handledBy: users.admin._id,
    handledAt: new Date()
  });
  if (complaintTwo.created) complaintsAdded += 1;

  console.log("\nDynaStay demo data seed completed (existing records were preserved).");
  console.log({
    demoUsers: Object.keys(users).length,
    demoListings: Object.keys(listings).length,
    demoUnits: Object.values(units).reduce((sum, items) => sum + items.length, 0),
    demoParkingSlots: Object.values(parkingSlots).reduce((sum, items) => sum + items.length, 0),
    reviewsAdded,
    propertyBookingsPresent: [bookingA, bookingB, bookingC, bookingD].length,
    propertyParkingReservationsAdded: propertyParkingAdded,
    independentParkingReservationsAdded: independentParkingAdded,
    complaintsPresent: 2,
    complaintsAdded
  });
  console.log("\nDEMO LOGIN ACCOUNTS (change these passwords if you keep this database):");
  console.log("Host:  host.aarav@dynastay.test / HostDemo#2026");
  console.log("Host:  host.ananya@dynastay.test / HostDemo#2026");
  console.log("Guest: guest.rohan@dynastay.test / GuestDemo#2026");
  console.log("Guest: guest.isha@dynastay.test / GuestDemo#2026");
  console.log("Guest: guest.kabir@dynastay.test / GuestDemo#2026");
  console.log("Guest: guest.meera@dynastay.test / GuestDemo#2026");
  console.log("Admin: admin@dynastay.test / AdminDemo#2026");
  console.log("\nNote: These are fictional demo accounts and fictional property details.");
}

seedDemoData()
  .catch(error => {
    console.error("DynaStay demo seeding failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
