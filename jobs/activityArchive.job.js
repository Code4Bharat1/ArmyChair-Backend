import ActivityLog from "../models/activityLog.model.js";
import ActivityLogBackup from "../models/activityLogBackup.model.js";
import { exportActivityLogsToExcel } from "../utils/exportToExcel.js";

export const archiveAndCleanupActivityLogs = async () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 1);

  // 1️⃣ Fetch logs
  const logs = await ActivityLog.find({
    createdAt: { $gte: start, $lt: end },
    isDeleted: false,
  });

  if (!logs.length) {
    console.log("ℹ No logs to archive");
    return;
  }

  // 2️⃣ Backup to MongoDB (SAFETY)
  await ActivityLogBackup.create({
    date: start.toISOString().split("T")[0],
    logs,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  // 3️⃣ Export to Excel
  await exportActivityLogsToExcel(start);

  // 4️⃣ Delete ONLY AFTER SUCCESS
  await ActivityLog.updateMany(
    { createdAt: { $gte: start, $lt: end } },
    { isDeleted: true }
  );

  console.log("✅ Activity logs archived & cleaned safely");
};
