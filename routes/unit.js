const express = require("express");
const router = express.Router({ mergeParams: true });

const Unit = require("../models/unit.js");
const Booking = require("../models/booking.js");
const { unitSchema } = require("../schema.js");
const { isLoggedIn, isOwner } = require("../middleware/auth.js");

// Validate unit request body
function validateUnit(req, res, next) {
    const { error, value } = unitSchema.validate(req.body);

    if (error) {
        return res.status(400).json({
            error: error.details.map(detail => detail.message)
        });
    }

    req.validatedUnit = value.unit;
    next();
}

// GET /listings/:id/units
// Listing owner can see the units belonging to their listing.
router.get("/", isLoggedIn, isOwner, async (req, res) => {
    const units = await Unit.find({
        listing: req.params.id
    }).sort({ createdAt: -1 });

    return res.status(200).json({ units });
});

// POST /listings/:id/units
// Create a unit under the owned listing.
router.post("/", isLoggedIn, isOwner, validateUnit, async (req, res) => {
    const unit = await Unit.create({
        ...req.validatedUnit,
        listing: req.params.id
    });

    return res.status(201).json({
        message: "Unit created successfully.",
        unit
    });
});

// PUT /listings/:id/units/:unitId
// Update only a unit that belongs to this listing.
router.put("/:unitId", isLoggedIn, isOwner, validateUnit, async (req, res) => {
    const unit = await Unit.findOne({
        _id: req.params.unitId,
        listing: req.params.id
    });

    if (!unit) {
        return res.status(404).json({
            error: "Unit not found in this listing."
        });
    }

    const updates = { ...req.validatedUnit };

    // Do not accidentally reset availability to true
    // when isAvailable was omitted from the request.
    if (!Object.prototype.hasOwnProperty.call(req.body.unit, "isAvailable")) {
        delete updates.isAvailable;
    }

    unit.set(updates);
    await unit.save();

    return res.status(200).json({
        message: "Unit updated successfully.",
        unit
    });
});

// DELETE /listings/:id/units/:unitId
// Preserve units that have booking history.
router.delete("/:unitId", isLoggedIn, isOwner, async (req, res) => {
    const unit = await Unit.findOne({
        _id: req.params.unitId,
        listing: req.params.id
    });

    if (!unit) {
        return res.status(404).json({
            error: "Unit not found in this listing."
        });
    }

    const hasBookingHistory = await Booking.exists({
        unit: unit._id
    });

    if (hasBookingHistory) {
        return res.status(409).json({
            error: "This unit has booking history and cannot be deleted. Set isAvailable to false instead."
        });
    }

    await Unit.deleteOne({ _id: unit._id });

    return res.status(200).json({
        message: "Unit deleted successfully."
    });
});

module.exports = router;
