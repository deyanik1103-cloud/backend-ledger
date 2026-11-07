const mongoose = require('mongoose');


const ledgerSchema = new mongoose.Schema({
    account: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "account",
        required: [true, "Account is required"],
        index: true,
        immutable: true
    },
    amount: {
        type: Number,
        required: [true, "Amount is required"],
        immutable: true
    },
    transaction: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "transaction",
        required: [true, "Transaction is required"],
        index: true,
        immutable: true
    },
    type: {
        type: String,
        enum: {
            values: ["CREDIT", "DEBIT"],
            message: "Type must be either CREDIT or DEBIT",
        },
        required: [true, "Type is required"],
        immutable: true
    }
})


function preventLedgerModification() {
    throw new Error("Ledger entries cannot be modified or deleted");
}


ledgerSchema.pre('findOneAndUpdate', preventLedgerModification);
ledgerSchema.pre('remove', preventLedgerModification);
ledgerSchema.pre('deleteOne', preventLedgerModification);
ledgerSchema.pre('updateOne', preventLedgerModification);
ledgerSchema.pre('deleteMany', preventLedgerModification);
ledgerSchema.pre('updateMany', preventLedgerModification);
ledgerSchema.pre('findOneAndDelete', preventLedgerModification);
ledgerSchema.pre('findOneAndRemove', preventLedgerModification);
ledgerSchema.pre('findOneAndReplace', preventLedgerModification);
ledgerSchema.pre('replaceOne', preventLedgerModification);


const ledgerModel = mongoose.model("ledger", ledgerSchema);

module.exports = ledgerModel;