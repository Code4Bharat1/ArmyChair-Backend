import mongoose from "mongoose";
const inventorySchema = new mongoose.Schema(
  {
    chairType: { type: String, required: true },
    quantity: { type: Number, required: true },

    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: function () {
        return this.type === "FULL";
      },
    },

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
      enum: ["admin", "user", "warehouse", "production"],
    },

    color: {
      type: String,
      required: function () {
        return this.type === "FULL";
      },
    },

    minQuantity: {
      type: Number,
      required: function () {
        return this.type === "FULL";
      },
    },

    priority: {
      type: String,
      enum: ["high", "low"],
      default: "high",
    },
  },
  { timestamps: true }
);

// 🔐 THIS IS THE KEY LINE
inventorySchema.index(
  { chairType: 1, location: 1, type: 1 },
  { unique: true }
);

export default mongoose.model("Inventory", inventorySchema);
