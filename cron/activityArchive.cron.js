import cron from "node-cron";
import { exportActivityLogsToExcel } from "../utils/exportToExcel.js";

export const startActivityArchiveCron = () => {
  cron.schedule("59 23 * * *", async () => {
    console.log("📦 Archiving activity logs to Excel...");

    try {
      await exportActivityLogsToExcel();
      console.log("✅ Activity logs archived successfully");
    } catch (err) {
      console.error("❌ Activity archive failed:", err);
    }
  });
};
