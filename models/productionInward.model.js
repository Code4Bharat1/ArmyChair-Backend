import mongoose from "mongoose";

const productionInwardSchema = new mongoose.Schema(
  {
    partName: { type: String },

    quantity: { type: Number, required: true, min: 1 },

    // vendor: { type: String, required: true },

    location: { type: String },

    // color: { type: String, required: true },

    // type: {
    //   type: String,
    //   enum: ["FULL", "SPARE"],
    //   default: "SPARE",
    // },

    status: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "REJECTED"],
      default: "PENDING",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // production
      required: true,
    },
assignedTo: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
  required: true,
},

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // warehouse
    },
  },
  { timestamps: true }
);

// ✅ INDEX MUST BE HERE
productionInwardSchema.index({ status: 1 });

export default mongoose.model("ProductionInward", productionInwardSchema);
