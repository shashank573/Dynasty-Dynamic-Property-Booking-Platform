require("dotenv").config(); // to add the session secreat automatically
if (
  process.env.NODE_ENV !== "test" &&
  !process.env.SESSION_SECRET
) {
  throw new Error("SESSION_SECRET is required");
}

const mongoose = require("mongoose");
const app = require("./app");

const MONGO_URL =
  process.env.MONGO_URL || "mongodb://127.0.0.1:27017/DynaStay";
const PORT = process.env.PORT || 8080;

async function startServer() {
  try {
    await mongoose.connect(MONGO_URL);
    console.log("MongoDB connection successful!");

    app.listen(PORT, () => {
      console.log(`Server is listening on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start DynaStay:", err.message);
    process.exit(1);
  }
}

startServer();