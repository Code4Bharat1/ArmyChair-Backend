import mongoose from "mongoose";

const productionInwardSchema = new mongoose.Schema(
  {
    partName: { type: String, required: true },

    quantity: { type: Number, required: true, min: 1 },

    location: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "REJECTED"],
      default: "PENDING",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// ✅ INDEX MUST BE HERE
productionInwardSchema.index({ status: 1 });

export default mongoose.model("ProductionInward", productionInwardSchema);
