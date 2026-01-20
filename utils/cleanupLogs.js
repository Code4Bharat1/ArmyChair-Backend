import ActivityLog from "../models/activityLog.model.js";

export const cleanupOldLogs = async () => {
  const limit = new Date(Date.now() - 1 * 60 * 1000); // 20 minutes ago

  const result = await ActivityLog.deleteMany({
    createdAt: { $lt: limit }
  });

  if (result.deletedCount > 0) {
    console.log(`🧹 Cleaned ${result.deletedCount} old activity logs`);
  }
};
