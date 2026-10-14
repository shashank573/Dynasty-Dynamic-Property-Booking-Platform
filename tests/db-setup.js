
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

let mongod;

async function connectToTestDB() {
    // OS - TEST DATABASE COORDINATION:
    // Replica set MongoDB transactions ko test karne ke liye required hai.
    mongod = await MongoMemoryReplSet.create({
        replSet: {
            count: 1
        }
    });

    await mongoose.connect(mongod.getUri());

    console.log("Connected to temporary replica-set test database");
}

async function clearTestDB() {
    const collections = mongoose.connection.collections;

    for (const collection of Object.values(collections)) {
        await collection.deleteMany({});
    }
}

async function closeTestDB() {
    console.log("[DEBUG] closeTestDB: started");

    try {
        if (mongoose.connection.readyState !== 0) {
            console.log("[DEBUG] mongoose.disconnect: starting");
            await mongoose.disconnect();
            console.log("[DEBUG] mongoose.disconnect: completed");
        } else {
            console.log("[DEBUG] mongoose already disconnected");
        }
    } finally {
        if (mongod) {
            console.log("[DEBUG] replica-set stop: starting");
            await mongod.stop();
            mongod = undefined;
            console.log("[DEBUG] replica-set stop: completed");
        } else {
            console.log("[DEBUG] replica-set already stopped");
        }
    }

    console.log("[DEBUG] closeTestDB: completed");
}

module.exports = {
    connectToTestDB,
    clearTestDB,
    closeTestDB
};