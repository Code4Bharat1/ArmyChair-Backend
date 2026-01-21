import cron from "node-cron";
import ActivityLog from "../models/activityLog.model.js";
import ActivityLogBackup from "../models/activityLogBackup.model.js";
import { exportActivityLogsToExcel } from "../utils/exportToExcel.js";

export const startActivityArchiveCron = () => {
  cron.schedule("59 23 * * *", async () => {
    console.log("📦 Starting daily activity archive job");

    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 1);

    try {
      // 1️⃣ Fetch today's logs
      const logs = await ActivityLog.find({
        createdAt: { $gte: start, $lt: end },
        isDeleted: false,
      });

      if (!logs.length) {
        console.log("ℹ No activity logs found for today");
        return;
      }

      // 2️⃣ Backup to MongoDB (SAFETY)
      await ActivityLogBackup.create({
        date: start.toISOString().split("T")[0],
        logs,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      // 3️⃣ Export to Excel (ARCHIVE)
      await exportActivityLogsToExcel(start);

      // 4️⃣ Soft delete logs
      await ActivityLog.updateMany(
        { createdAt: { $gte: start, $lt: end } },
        { isDeleted: true }
      );

      console.log("✅ Activity logs archived & cleaned safely");
    } catch (err) {
      console.error("❌ Activity archive cron failed:", err);
    }
  });
};
