import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true },

    dispatchedTo: { type: String, required: true },

    chairModel: { type: String, required: true },

    chairDetail: { type: String, default: "" },

    orderDate: { type: Date, required: true },

    deliveryDate: { type: Date, required: true },

    onTime: { type: Boolean, default: true },

    assembly: {
      type: String,
      enum: ["Assembled", "Dismantled"],
      required: true,
    },

    status: {
      type: String,
      enum: ["Pending", "Dispatched", "Delivered", "Cancelled"],
      default: "Pending",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Order", orderSchema);
