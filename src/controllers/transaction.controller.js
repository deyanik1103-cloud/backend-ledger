const transactionModel = require('../models/transaction.model')
const ledgerModel = require('../models/ledger.model')
const accountModel = require('../models/account.model')
const emailService = require('../services/email.service')
const mongoose = require("mongoose")

/**
 * - Create a new transaction
 * THE 10-STEPS transfer FLOW:
 * 1. Validate request
 * 2. Validate idempotency key
 * 3. Check account status
 * 4. Derive sender balance from ledger
 * 5. Create transaction (PENDING)
 * 6. Create DEBIT ledger entry
 * 7. Create CREDIT ledger entry
 * 8. Mark transaction COMPLETED
 * 9. Commit MongoDB session
 * 10. Send email notification
 */

async function createTransaction(req, res) {
    const { fromAccount, toAccount, amount, idempotencyKey } = req.body

    /**
     * 1. Validate request
     */
    if (!fromAccount || !toAccount || !amount || !idempotencyKey) {
        return res.status(400).json({
            message: "fromAccount, toAccount, amount and idempotencyKey are required"
        })
    }

    if (typeof amount !== "number" || amount <= 0) {
        return res.status(400).json({
            message: "Amount must be a number greater than 0"
        })
    }

    const fromUserAccount = await accountModel.findById(fromAccount)
    const toUserAccount = await accountModel.findById(toAccount)

    if (!fromUserAccount || !toUserAccount) {
        return res.status(404).json({
            message: "From account or to account not found"
        })
    }

    // The sender account must belong to the logged-in user
    if (String(fromUserAccount.user) !== String(req.user._id)) {
        return res.status(403).json({
            message: "You can only transfer money from your own account"
        })
    }

    /**
     * 2. Validate idempotency key
     */
    const existingTransaction = await transactionModel.findOne({ idempotencyKey })

    if (existingTransaction) {
        if (existingTransaction.status === "COMPLETED") {
            return res.status(200).json({
                message: "Transaction already processed successfully",
                transaction: existingTransaction
            })
        }

        if (existingTransaction.status === "PENDING") {
            return res.status(200).json({
                message: "Transaction is still pending"
            })
        }

        if (existingTransaction.status === "FAILED") {
            return res.status(500).json({
                message: "Transaction failed previously, please try again"
            })
        }

        if (existingTransaction.status === "REVERSED") {
            return res.status(500).json({
                message: "Transaction was reversed, please try again"
            })
        }
    }

    /**
     * 3. Check account status
     */
    if (fromUserAccount.status !== "ACTIVE" || toUserAccount.status !== "ACTIVE") {
        return res.status(400).json({
            message: "One or both accounts are not active"
        })
    }

    /**
     * 4. Derive sender balance from ledger
     */
    const balance = await fromUserAccount.getBalance()

    if (balance < amount) {
        return res.status(400).json({
            message: `Insufficient balance. Current balance is ${balance}. Requested amount is ${amount}`
        })
    }

    /**
     * 5-9. Create transaction + ledger entries inside one MongoDB session
     */
    const session = await mongoose.startSession()
    let transaction

    try {
        session.startTransaction()

        // With { session }, create() needs an ARRAY of documents
        const created = await transactionModel.create([{
            fromAccount,
            toAccount,
            amount,
            idempotencyKey,
            status: "PENDING"
        }], { session })

        transaction = created[0]

        await ledgerModel.create([
            {
                account: fromAccount,
                amount,
                transaction: transaction._id,
                type: "DEBIT"
            },
            {
                account: toAccount,
                amount,
                transaction: transaction._id,
                type: "CREDIT"
            }
        ], { session, ordered: true })

        transaction.status = "COMPLETED"
        await transaction.save({ session })

        await session.commitTransaction()
    } catch (error) {
        await session.abortTransaction()
        console.error("Transaction error:", error.message)

        return res.status(500).json({
            message: "Transaction failed",
            error: error.message
        })
    } finally {
        session.endSession()
    }

    /**
     * 10. Send email notification
     */
    await emailService.sendTransactionEmail(req.user.email, req.user.name, amount, toAccount)

    return res.status(201).json({
        message: "Transaction completed successfully",
        transaction
    })
}


/**
 * - Create initial funds transaction from the system user
 * - POST /api/transactions/system/initial-funds
 */
async function createInitialFundsTransaction(req, res) {
    const { toAccount, amount, idempotencyKey } = req.body

    if (!toAccount || !amount || !idempotencyKey) {
        return res.status(400).json({
            message: "toAccount, amount and idempotencyKey are required"
        })
    }

    if (typeof amount !== "number" || amount <= 0) {
        return res.status(400).json({
            message: "Amount must be a number greater than 0"
        })
    }

    const toUserAccount = await accountModel.findById(toAccount)

    if (!toUserAccount) {
        return res.status(400).json({
            message: "Invalid toAccount"
        })
    }

    const fromUserAccount = await accountModel.findOne({
        user: req.user._id
    })

    if (!fromUserAccount) {
        return res.status(400).json({
            message: "System user account not found"
        })
    }

    const existing = await transactionModel.findOne({ idempotencyKey })

    if (existing) {
        return res.status(200).json({
            message: "Transaction already processed",
            transaction: existing
        })
    }

    const session = await mongoose.startSession()
    let transaction

    try {
        session.startTransaction()

        transaction = new transactionModel({
            fromAccount: fromUserAccount._id,
            toAccount,
            amount,
            idempotencyKey,
            status: "PENDING"
        })

        await ledgerModel.create([
            {
                account: fromUserAccount._id,
                amount,
                transaction: transaction._id,
                type: "DEBIT"
            },
            {
                account: toAccount,
                amount,
                transaction: transaction._id,
                type: "CREDIT"
            }
        ], { session, ordered: true })

        transaction.status = "COMPLETED"
        await transaction.save({ session })

        await session.commitTransaction()
    } catch (error) {
        await session.abortTransaction()
        console.error("Initial funds error:", error.message)

        return res.status(500).json({
            message: "Initial funds transaction failed",
            error: error.message
        })
    } finally {
        session.endSession()
    }

    return res.status(201).json({
        message: "Initial funds transaction completed successfully",
        transaction
    })
}

module.exports = {
    createTransaction,
    createInitialFundsTransaction
}