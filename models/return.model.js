import mongoose from "mongoose";

const returnSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
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

    // movedToInventory: {
    //   type: Boolean,
    //   default: false,
    // },

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
  enum: [
    "Pending",
    "In-Fitting",
    "Accepted",
    "Rejected",
    "Bad-Inventory"
  ],
  default: "Pending",
},

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

  },
  { timestamps: true }
);

export default mongoose.model("Return", returnSchema);
