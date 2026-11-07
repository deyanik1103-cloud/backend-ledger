const express = require("express")
const { authMiddleware } = require("../middleware/auth.middleware")
const accountController = require("../controllers/account.controller")

const router = express.Router()

/**
 * - POST /api/accounts/
 * - Create a new account
 * - Protected Route
 */
router.post("/", authMiddleware, accountController.createAccountController)

/**
 * - GET /api/accounts/
 * - Get all accounts of the logged-in user (with balances)
 * - Protected Route
 */
router.get("/", authMiddleware, accountController.getUserAccountController)

/**
 * - GET /api/accounts/balance/:accountId
 * - Get balance of one of the user's accounts
 * - Protected Route
 */
router.get("/balance/:accountId", authMiddleware, accountController.getAccountBalanceController)

/**
 * - GET /api/accounts/lookup/:accountId
 * - Find the owner name of any account (recipient check)
 * - Protected Route
 */
router.get("/lookup/:accountId", authMiddleware, accountController.lookupAccountController)

module.exports = router
