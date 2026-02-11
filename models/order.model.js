import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      unique: true,
      trim: true,
    },

    dispatchedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },

    chairModel: {
      type: String,
      required: true,
      trim: true,
    },
    orderType: {
      type: String,
      enum: ["FULL", "SPARE"],
      default: "FULL",
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

    lastAmendedAt: Date,
    amendedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },


    isPartial: {
      type: Boolean,
      default: false,
    },
    progress: {
      type: String,
      enum: [
        "ORDER_PLACED",
        "PRODUCTION_PENDING",
        "PRODUCTION_IN_PROGRESS",   // 👈 ADD THIS
        "PRODUCTION_COMPLETED",
        "WAREHOUSE_COLLECTED",
        "FITTING_IN_PROGRESS",
        "FITTING_COMPLETED",
        "READY_FOR_DISPATCH",
        "DISPATCHED",
        "PARTIAL",
      ],
    },


    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    salesPerson: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    productionWorker: {
      type: String, // just store worker name
    },

    productionAssignedAt: {
      type: Date,
    },

    productionCompletedAt: {
      type: Date,
    },
    productionParts: {
  type: Object,
  default: {},
},
    partialAccepted: {
      type: Boolean,
      default: false,
    },

    partialBuildableQty: {
      type: Number,
      default: 0,
    },

    partialParts: [
      {
        inventoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Inventory" },
        qty: Number,
      },
    ],


  },
  { timestamps: true }
);

/* =========================================================
   AUTO ORDER ID GENERATOR
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
