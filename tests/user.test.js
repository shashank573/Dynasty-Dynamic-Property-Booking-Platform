const test = require("node:test");
const assert = require("node:assert/strict");

const User = require("../models/user");

const {
connectToTestDB,
clearTestDB,
closeTestDB
} = require("./db-setup");

test("User model password hashing", async (t) => {
await connectToTestDB();

try {
    await t.test("hashes password and verifies correct and incorrect passwords", async () => {
        const user = await User.create({
            name: "Test Guest",
            email: "test-guest@example.com",
            password: "SecurePass123"
        });

        assert.ok(user._id);
        assert.notEqual(user.password, "SecurePass123");

        assert.equal(
            await user.comparePassword("SecurePass123"),
            true
        );

        assert.equal(
            await user.comparePassword("WrongPass123"),
            false
        );
    });

    await clearTestDB();

    await t.test("assigns Guest role by default", async () => {
        const user = await User.create({
            name: "Default Guest",
            email: "default-guest@example.com",
            password: "SecurePass123"
        });

        assert.equal(user.role, "Guest");
    });
} finally {
    await closeTestDB();
}

});
