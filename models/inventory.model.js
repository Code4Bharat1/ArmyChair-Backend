import mongoose from "mongoose";

const inventorySchema = new mongoose.Schema(
  {
    ProductName: { type: String, required: true },
    VendorName: { type: String, required: true },
    Quantity: { type: Number, required: true },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    createdByRole: {
      type: String,
      enum: ["admin", "user"],
    },
  },
  { timestamps: true }
);

export default mongoose.model("Inventory", inventorySchema);
