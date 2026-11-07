const { Router } = require('express');
const { authMiddleware, authSystemUserMiddleware } = require('../middleware/auth.middleware');
const transactionController = require("../controllers/transaction.controller")

const transactionRoutes = Router();

/**
 * - POST /api/transactions/
 * - Create a new transaction
 * - Protected Route
 */
transactionRoutes.post("/", authMiddleware, transactionController.createTransaction)

/**
 * - GET /api/transactions/
 * - Transaction history of the logged-in user
 * - Protected Route
 */
transactionRoutes.get("/", authMiddleware, transactionController.getTransactionHistory)

/**
 * - POST /api/transactions/system/initial-funds
 * - Create initial funds transaction from system user
 */
transactionRoutes.post("/system/initial-funds", authSystemUserMiddleware, transactionController.createInitialFundsTransaction)

module.exports = transactionRoutes
