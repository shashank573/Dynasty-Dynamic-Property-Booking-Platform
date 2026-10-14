const Joi = require("joi");
//listing
module.exports.listingSchema = Joi.object({
    listing: Joi.object({
        title: Joi.string().required(),
        description: Joi.string().required(),
        image : Joi.string().allow("", null),
        price: Joi.number().required().min(0),
        country: Joi.string().required(),
        location: Joi.string().required(),
    }).required()
});

//reviews
module.exports.reviewSchema = Joi.object({
    review: Joi.object({
        rating: Joi.number().required().min(1).max(5),
        comment: Joi.string().required(),
    }).required()
});

//booking
module.exports.bookingSchema = Joi.object({
    booking: Joi.object({
        unit: Joi.string().hex().length(24).required(),

        checkIn: Joi.string()
            .pattern(/^\d{4}-\d{2}-\d{2}$/)
            .custom((value, helpers) => {
                const [year, month, day] = value.split("-").map(Number);
                const date = new Date(Date.UTC(year, month - 1, day));

                const isValidDate =
                    date.getUTCFullYear() === year &&
                    date.getUTCMonth() === month - 1 &&
                    date.getUTCDate() === day;

                if (!isValidDate) {
                    return helpers.error("any.invalid");
                }

                return value;
            }, "valid calendar date")
            .required(),

        checkOut: Joi.string()
            .pattern(/^\d{4}-\d{2}-\d{2}$/)
            .custom((value, helpers) => {
                const [year, month, day] = value.split("-").map(Number);
                const date = new Date(Date.UTC(year, month - 1, day));

                const isValidDate =
                    date.getUTCFullYear() === year &&
                    date.getUTCMonth() === month - 1 &&
                    date.getUTCDate() === day;

                if (!isValidDate) {
                    return helpers.error("any.invalid");
                }

                return value;
            }, "valid calendar date")
            .required()
    })
    .required()
    .custom((booking, helpers) => {
        if (booking.checkIn && booking.checkOut &&
            booking.checkOut <= booking.checkIn) {
            return helpers.error("any.invalid", {
                message: "Check-out must be after check-in."
            });
        }

        return booking;
    }, "check-out after check-in")
});

//individual unit
module.exports.unitSchema = Joi.object({
    unit: Joi.object({
        name: Joi.string().trim().min(1).max(100).required(),

        description: Joi.string().trim().allow("").max(1000).default(""),

        capacity: Joi.number().integer().min(1).required(),

        pricePerNight: Joi.number().min(0).required(),

        isAvailable: Joi.boolean().default(true)
    }).required()
});
