import mongoose from "mongoose";

const inventorySchema = new mongoose.Schema(
  {
    chairType: { type: String, required: true },
    quantity: { type: Number, required: true },
    vendor: {type: String, required: true},           //from where the parts are sourced
    location: { type: String }, 

    type: {
      type: String,
      enum: ["FULL", "SPARE"],
      default: "FULL",
    },

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
