import mongoose from "mongoose";

const activityLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    userName: { type: String, required: true },
    userRole: { type: String, required: true },

    action: { type: String, required: true }, // WORK_TIME, INVENTORY_IN, ORDER_CREATE…
    module: { type: String, required: true }, // Inventory, Order, Warehouse, Production…

    entityType: { type: String }, // Inventory, Order, ProductionInward…
    entityId: { type: mongoose.Schema.Types.ObjectId },

    description: { type: String, required: true },

    sourceLocation: { type: String },
    destination: { type: String },
    assignedBy: { type: String },
  },
  { timestamps: true },
);

export default mongoose.model("ActivityLog", activityLogSchema);
