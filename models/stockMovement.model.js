import mongoose from "mongoose";

const stockMovementSchema = new mongoose.Schema(
  {
    partName: String,
    chairType: String,

    fromLocation: String,
    toLocation: String,

    quantity: Number,

    movedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    reason: {
      type: String,
      enum: ["TRANSFER", "DISPATCH", "RETURN", "ADJUSTMENT"],
      default: "TRANSFER",
    },
  },
  { timestamps: true }
);

export default mongoose.model("StockMovement", stockMovementSchema);
