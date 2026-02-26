import mongoose from "mongoose";

const returnSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      // ❌ removed unique: true — compound index below handles uniqueness
    },

    chairType: {
      type: String,
      required: true,
    },

    description: {
      type: String,
    },

    quantity: {
      type: Number,
      default: 1,
    },

    returnDate: {
      type: Date,
      required: true,
    },

    category: {
      type: String,
      enum: ["Functional", "Non-Functional"],
      required: true,
    },

    vendor: {
      type: String,
      required: true,
    },

    location: {
      type: String,
    },

    returnedFrom: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["Pending", "In-Fitting", "Accepted", "Rejected", "Bad-Inventory", "Completed"],
      default: "Pending",
    },

    items: [
      {
        name:           { type: String, required: true },
        quantity:       { type: Number, required: true },
        fittingStatus:  { type: String, enum: ["PENDING", "GOOD", "BAD"], default: "PENDING" },
        fittingRemarks: { type: String, default: "" },
      },
    ],

    fittingDecision: {
      type: String,
      enum: ["Accepted", "Rejected"],
      default: null,
    },

    fittingRemarks: {
      type: String,
      default: "",
    },

    deliveryDate: {
      type: Date,
      required: true,
    },

    movedToInventory: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);


returnSchema.index({ orderId: 1, category: 1 }, { unique: true });

// ✅ single export
export default mongoose.model("Return", returnSchema);