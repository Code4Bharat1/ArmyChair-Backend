import mongoose from "mongoose";

const workSessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  module: { type: String, required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  startedAt: Date,
  lastActive: Date,
  totalSeconds: { type: Number, default: 0 },
  isPaused: { type: Boolean, default: false },
}, { timestamps: true });

workSessionSchema.index(
  { user: 1, module: 1, date: 1 },
  { unique: true }
);


export default mongoose.model("WorkSession", workSessionSchema);
