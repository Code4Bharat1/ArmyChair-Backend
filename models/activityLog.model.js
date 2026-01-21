import mongoose from "mongoose";

const activityLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    userName: { type: String, required: true },
    userRole: { type: String, required: true },

    action: { type: String, required: true },
    module: { type: String, required: true },

    entityType: { type: String },
    entityId: { type: mongoose.Schema.Types.ObjectId },

    description: { type: String, required: true },

    sourceLocation: { type: String },
    destination: { type: String },
    assignedBy: { type: String },

    // 🔐 SAFETY
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("ActivityLog", activityLogSchema);
