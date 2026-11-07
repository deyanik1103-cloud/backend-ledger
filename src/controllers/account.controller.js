const mongoose = require("mongoose")
const accountModel = require("../models/account.model")


/**
 * - POST /api/accounts
 */
async function createAccountController(req, res) {
    const user = req.user

    const account = await accountModel.create({
        user: user._id
    })

    res.status(201).json({
        account: { ...account.toObject(), balance: 0 }
    })
}


/**
 * - GET /api/accounts
 * - Returns the logged-in user's accounts, each with its current balance
 */
async function getUserAccountController(req, res) {
    const accounts = await accountModel.find({ user: req.user._id }).sort({ createdAt: 1 })

    const accountsWithBalance = await Promise.all(
        accounts.map(async (account) => ({
            ...account.toObject(),
            balance: await account.getBalance()
        }))
    )

    res.status(200).json({
        accounts: accountsWithBalance
    })
}


/**
 * - GET /api/accounts/balance/:accountId
 */
async function getAccountBalanceController(req, res) {
    const { accountId } = req.params

    if (!mongoose.isValidObjectId(accountId)) {
        return res.status(400).json({
            message: "Invalid account id"
        })
    }

    const account = await accountModel.findOne({
        _id: accountId,
        user: req.user._id
    })

    if (!account) {
        return res.status(404).json({
            message: "Account not found"
        })
    }

    const balance = await account.getBalance()

    res.status(200).json({
        accountId: account._id,
        balance: balance
    })
}


/**
 * - GET /api/accounts/lookup/:accountId
 * - Shows who owns an account, so the sender can confirm the recipient before transferring
 */
async function lookupAccountController(req, res) {
    const { accountId } = req.params

    if (!mongoose.isValidObjectId(accountId)) {
        return res.status(400).json({
            message: "Account ID must be 24 characters"
        })
    }

    const account = await accountModel.findById(accountId).populate("user", "name")

    if (!account) {
        return res.status(404).json({
            message: "No account found with this ID"
        })
    }

    res.status(200).json({
        accountId: account._id,
        ownerName: account.user?.name || "Unknown",
        status: account.status,
        currency: account.currency
    })
}

module.exports = {
    createAccountController,
    getUserAccountController,
    getAccountBalanceController,
    lookupAccountController
}
