import mongoose from "mongoose";

const activityLogBackupSchema = new mongoose.Schema({
  date: { type: String, required: true },
  logs: { type: Array, required: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: {
    type: Date,
    index: { expires: 0 }, // TTL index
  },
});

export default mongoose.model(
  "ActivityLogBackup",
  activityLogBackupSchema
);
