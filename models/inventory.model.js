import mongoose from "mongoose";

const inventorySchema = new mongoose.Schema(
  {
    chairType: { type: String, required: true },
    quantity: { type: Number, required: true },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    
    createdByRole: {
      type: String,
      enum: ["admin", "user"],
    },

    priority: {
      type: String,
      enum: ["high", "low"],
      default: "high",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Inventory", inventorySchema);
