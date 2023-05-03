const mongoose = require("mongoose");

const pocket_transactionSchema = new mongoose.Schema(
  {
    order_id: {
        type: Number,
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
    currency: {
        type: String,
    },
    amount_bnd: {
        type: Number,
    },
    phone: {
      type: String,
    },
    merchant_id: {
        type: String,
    },
    transaction_hashed_data: {
        type: String,
    },
    order_info: {
        type: String,
    },
    order_status_id: {
        type: String,
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Pocket_Transaction", pocket_transactionSchema);