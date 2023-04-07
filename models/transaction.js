const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    order_id: {
        type: String,
    },
    name: {
        type: String,
    },
    email: {
        type: String,
    },
    amount: {
        type: Number,
    },
    phone: {
      type: String,
    },
    merchant_id: {
        type: String,
      },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Transaction", transactionSchema);