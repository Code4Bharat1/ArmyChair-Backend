import mongoose from "mongoose";

const badReturnSchema = new mongoose.Schema(
  {
    orderId: String,
    chairType: String,
    quantity: Number,
    reason: String,
    returnedFrom: String,

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

export default mongoose.model("BadReturn", badReturnSchema);
