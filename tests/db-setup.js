
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongod;

async function connectToTestDB() {
    mongod = await MongoMemoryServer.create();

    await mongoose.connect(mongod.getUri());

    console.log("Connected to temporary test database");
}

async function clearTestDB() {
    const collections = mongoose.connection.collections;

    for (const collection of Object.values(collections)) {
        await collection.deleteMany({});
    }
}

async function closeTestDB() {
    try {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
    } finally {
        if (mongod) {
            await mongod.stop();
            mongod = undefined;
        }
    }
}

module.exports = {
    connectToTestDB,
    clearTestDB,
    closeTestDB
};