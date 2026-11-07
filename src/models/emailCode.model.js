const mongoose = require("mongoose")

/**
 * - One row per email address waiting to be verified.
 * - The code itself is never stored, only a hash of it.
 */
const emailCodeSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    codeHash: {
        type: String,
        required: true
    },
    attempts: {
        type: Number,
        default: 0
    },
    sentAt: {
        type: Date,
        required: true
    },
    expiresAt: {
        type: Date,
        required: true
    }
}, {
    timestamps: true
})

// MongoDB removes the row automatically after it expires
emailCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

const emailCodeModel = mongoose.model("emailCode", emailCodeSchema)

module.exports = emailCodeModel
