import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    department: {
      type: String,
      enum: ["Sales", "Warehouse", "Fitting", "Production"],
      required: true,
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    task: {
      type: String,
      required: true,
      trim: true,
    },

    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: ["Pending", "Completed"],
      default: "Pending",
    },

    completedAt: Date,
  },
  { timestamps: true }
);

export default mongoose.model("Task", taskSchema);
