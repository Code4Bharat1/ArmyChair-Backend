import mongoose from "mongoose";

const rawSchema = new mongoose.Schema(
  {
    productName: { type: String, required: true },
    type: { type: String, required: true },
    colour: { type: String, required: true },
    setNo: { type: Number, required: true },
    company: { type: String, required: true },
  
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

export default mongoose.model("Raw", rawSchema);
