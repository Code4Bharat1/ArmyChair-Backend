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

    movedToInventory: {
      type: Boolean,
      default: false,
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

deliveryDate: {
  type: Date,
  required: true,
},

  },
  { timestamps: true }
);

export default mongoose.model("Return", returnSchema);
