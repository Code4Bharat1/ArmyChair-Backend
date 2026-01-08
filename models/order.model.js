import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    dispatchedTo: {
      type: String,
      required: true,
      trim: true,
    },

    chairModel: {
      type: String,
      required: true,
    },

    chairDetail: {
      type: String,
    },

    orderDate: {
      type: Date,
      required: true,
    },

    deliveryDate: {
      type: Date,
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    progress: {
      type: String,
      enum: [
        "warehouse",
        "fitting",
        "order_ready",
        "dispatched",
        "delivered",
      ],
      default: "warehouse",
    },

    onTime: {
      type: Boolean,
      default: true,
    },

    assembly: {
      type: String,
      enum: ["Assembled", "Unassembled"],
      default: "Unassembled",
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Order", orderSchema);
