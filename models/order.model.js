import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
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
      trim: true,
    },

    orderDate: {
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
        "ORDER_PLACED",
        "WAREHOUSE_COLLECTED",
        "FITTING_IN_PROGRESS",
        "FITTING_COMPLETED",
        "READY_FOR_DISPATCH",
        "DISPATCHED", 

      ],
      default: "ORDER_PLACED",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

/* =========================================================
   ✅ AUTO ORDER ID GENERATOR
========================================================= */

orderSchema.pre("save", async function () {
  if (this.orderId) return;

  const year = new Date().getFullYear();

  const lastOrder = await mongoose
    .model("Order")
    .findOne({ orderId: { $regex: `^ORD-${year}-` } })
    .sort({ createdAt: -1 });

  let nextNumber = 1;

  if (lastOrder?.orderId) {
    const lastNum = parseInt(lastOrder.orderId.split("-")[2]);
    nextNumber = lastNum + 1;
  }

  this.orderId = `ORD-${year}-${String(nextNumber).padStart(6, "0")}`;
});

export default mongoose.model("Order", orderSchema);
