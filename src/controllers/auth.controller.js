const crypto = require("crypto")
const userModel = require("../models/user.model")
const jwt = require("jsonwebtoken")
const emailService = require("../services/email.service")
const tokenBlackListModel = require("../models/blackList.model")
const emailCodeModel = require("../models/emailCode.model")

const CODE_TTL_SECONDS = 180          // the code works for 3 minutes
const RESEND_COOLDOWN_SECONDS = 30    // wait before asking for another code
const MAX_ATTEMPTS = 5                // wrong guesses allowed per code

/* ---------- helpers ---------- */

function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase()
}

function hashCode(email, code) {
    return crypto
        .createHmac("sha256", process.env.JWT_SECRET)
        .update(`${email}:${code}`)
        .digest("hex")
}

function codesMatch(a, b) {
    const bufA = Buffer.from(a)
    const bufB = Buffer.from(b)
    return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)
}

// Seconds the user still has to wait before a new code may be sent (0 = can send now)
async function cooldownRemaining(email) {
    const record = await emailCodeModel.findOne({ email })
    if (!record) return 0
    const elapsed = (Date.now() - record.sentAt.getTime()) / 1000
    return Math.max(0, Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed))
}

// Creates a fresh 6-digit code, stores its hash and emails it. Returns true if the email went out.
async function sendNewCode(user) {
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0")

    await emailCodeModel.findOneAndUpdate(
        { email: user.email },
        {
            codeHash: hashCode(user.email, code),
            attempts: 0,
            sentAt: new Date(),
            expiresAt: new Date(Date.now() + CODE_TTL_SECONDS * 1000)
        },
        { upsert: true }
    )

    const sent = await emailService.sendVerificationEmail(user.email, user.name, code, CODE_TTL_SECONDS / 60)

    if (!sent) {
        await emailCodeModel.deleteOne({ email: user.email })
    }

    return sent
}

function codeTimers() {
    return {
        expiresInSeconds: CODE_TTL_SECONDS,
        resendInSeconds: RESEND_COOLDOWN_SECONDS
    }
}

/* ---------- controllers ---------- */

/*
* - user register controller
* - POST /api/auth/register
* - Creates the profile as "not verified" and emails a 6-digit code
*/
async function userRegisterController(req, res) {
    const { password, name } = req.body
    const email = normalizeEmail(req.body.email)

    if (!email || !password || !name) {
        return res.status(400).json({
            message: "Name, email and password are required"
        })
    }

    const existing = await userModel.findOne({ email })

    // Older users have no emailVerified field, so only "false" counts as not verified
    if (existing && existing.emailVerified !== false) {
        return res.status(422).json({
            message: "Email already exists",
            status: "error"
        })
    }

    const wait = await cooldownRemaining(email)

    if (wait > 0) {
        return res.status(429).json({
            message: `A code was just sent. Please wait ${wait} seconds before trying again`,
            retryAfter: wait
        })
    }

    let user

    if (existing) {
        // Signed up before but never entered the code: let them start again with new details
        existing.name = name
        existing.password = password
        await existing.save()
        user = existing
    } else {
        user = await userModel.create({ email, password, name, emailVerified: false })
    }

    const sent = await sendNewCode(user)

    if (!sent) {
        return res.status(502).json({
            message: "We could not send the verification email. Check the address and try again"
        })
    }

    return res.status(201).json({
        message: "Verification code sent",
        needsVerification: true,
        email: user.email,
        ...codeTimers()
    })
}

/**
 * - Verify email controller
 * - POST /api/auth/verify-email
 * - Body: { email, code }
 */
async function verifyEmailController(req, res) {
    const email = normalizeEmail(req.body.email)
    const code = String(req.body.code || "").trim()

    if (!email || !code) {
        return res.status(400).json({
            message: "Email and code are required"
        })
    }

    const record = await emailCodeModel.findOne({ email })

    if (!record || record.expiresAt.getTime() < Date.now()) {
        if (record) await record.deleteOne()

        return res.status(400).json({
            message: "This code has expired. Request a new one",
            expired: true
        })
    }

    if (!codesMatch(hashCode(email, code), record.codeHash)) {
        record.attempts += 1

        if (record.attempts >= MAX_ATTEMPTS) {
            await record.deleteOne()

            return res.status(429).json({
                message: "Too many wrong attempts. Request a new code",
                expired: true
            })
        }

        await record.save()

        const left = MAX_ATTEMPTS - record.attempts

        return res.status(400).json({
            message: `Wrong code. ${left} ${left === 1 ? "attempt" : "attempts"} left`
        })
    }

    const user = await userModel.findOne({ email }).select("+systemUser")

    if (!user) {
        await record.deleteOne()

        return res.status(404).json({
            message: "No profile found for this email. Please sign up again"
        })
    }

    await userModel.updateOne({ _id: user._id }, { emailVerified: true })
    await record.deleteOne()

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "3d" })
    res.cookie("token", token)

    res.status(200).json({
        user: {
            _id: user._id,
            email: user.email,
            name: user.name,
            systemUser: user.systemUser
        },
        token
    })

    // Welcome email is sent after the response, so the user never waits for it
    emailService.sendRegistrationEmail(user.email, user.name)
}

/**
 * - Resend code controller
 * - POST /api/auth/resend-code
 * - Body: { email }
 */
async function resendCodeController(req, res) {
    const email = normalizeEmail(req.body.email)

    if (!email) {
        return res.status(400).json({
            message: "Email is required"
        })
    }

    const user = await userModel.findOne({ email })

    // Same answer whether or not the email exists, so nobody can probe for registered emails
    if (!user || user.emailVerified !== false) {
        return res.status(200).json({
            message: "If this email is waiting for verification, a new code has been sent",
            ...codeTimers()
        })
    }

    const wait = await cooldownRemaining(email)

    if (wait > 0) {
        return res.status(429).json({
            message: `Please wait ${wait} seconds before requesting another code`,
            retryAfter: wait
        })
    }

    const sent = await sendNewCode(user)

    if (!sent) {
        return res.status(502).json({
            message: "We could not send the verification email. Try again in a moment"
        })
    }

    return res.status(200).json({
        message: "A new code has been sent",
        ...codeTimers()
    })
}

/**
 * - User login controller
 * - POST /api/auth/login
 */
async function userLoginController(req, res) {
    const { password } = req.body
    const email = normalizeEmail(req.body.email)

    const user = await userModel.findOne({ email }).select("+password +systemUser")

    if (!user) {
        return res.status(401).json({
            message: "Invalid email or password"
        })
    }

    const isValidPassword = await user.comparePassword(password)

    if (!isValidPassword) {
        return res.status(401).json({
            message: "Invalid email or password"
        })
    }

    if (user.emailVerified === false) {
        return res.status(403).json({
            message: "Please verify your email to continue",
            needsVerification: true,
            email: user.email
        })
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "3d" })
    res.cookie("token", token)
    res.status(200).json({
        user: {
            _id: user._id,
            email: user.email,
            name: user.name,
            systemUser: user.systemUser
        },
        token
    })
}

/**
 * - User logout controller
 * - POST /api/auth/logout
 */
async function userLogoutController(req, res) {
    const token = req.headers.authorization?.split(" ")[1] || req.cookies.token

    if (!token) {
        return res.status(200).json({
            message: "User logged out successfully"
        })
    }

    try {
        await tokenBlackListModel.create({ token })
    } catch (err) {
        // 11000 = token was already blacklisted, safe to ignore
        if (err.code !== 11000) throw err
    }

    res.clearCookie("token")

    res.status(200).json({
        message: "User logged out successfully"
    })
}

module.exports = {
    userRegisterController,
    verifyEmailController,
    resendCodeController,
    userLoginController,
    userLogoutController
}
