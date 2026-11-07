const express = require("express")
const cookieParser = require("cookie-parser")
const path = require("path")

const app = express()

app.use(express.json())
app.use(cookieParser())

/**
 * - Serve the Aurum frontend (public/index.html) from the same server,
 *   so no CORS setup is needed
 */
app.use(express.static(path.join(__dirname, "..", "public")))

/**
 * - Routes required
 */
const authRouter = require("./routes/auth.routes")
const accountRouter = require("./routes/account.routes")
const transactionRoutes = require("./routes/transaction.routes")

/**
 * - Use Routes
 */
app.use("/api/auth", authRouter)
app.use("/api/accounts", accountRouter)
app.use("/api/transactions", transactionRoutes)

/**
 * - Central error handler: always answers with JSON so the frontend can show the message
 */
app.use((err, req, res, next) => {
    console.error("Error:", err.message)

    if (err.name === "ValidationError") {
        const message = Object.values(err.errors).map(e => e.message).join(", ")
        return res.status(400).json({ message })
    }

    if (err.name === "CastError") {
        return res.status(400).json({ message: "Invalid id" })
    }

    if (err.code === 11000) {
        return res.status(422).json({ message: "This value already exists" })
    }

    res.status(500).json({ message: err.message || "Internal server error" })
})

module.exports = app
