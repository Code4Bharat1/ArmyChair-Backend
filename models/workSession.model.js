import mongoose from "mongoose";

const workSessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  module: { type: String, required: true },
  startedAt: Date,
  lastActive: Date,
  totalSeconds: { type: Number, default: 0 },
  isPaused: { type: Boolean, default: false },
}, { timestamps: true });

workSessionSchema.index({ user: 1 }, { unique: true });

export default mongoose.model("WorkSession", workSessionSchema);
