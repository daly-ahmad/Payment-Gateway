const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
        type: String,
    },
    email: {
        type: String,
    },
    password: {
        type: String,
        minLength: 6,
        select: false
    },
    priv: {
      type: String,
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);