import cron from "node-cron";
import { cleanupOldLogs } from "../utils/cleanupLogs.js";

export const startActivityCleanupCron = () => {
  cron.schedule("*/20 * * * *", async () => {
    try {
      await cleanupOldLogs();
    } catch (err) {
      console.error("Cleanup failed:", err);
    }
  });
};
