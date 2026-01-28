import cron from "node-cron";
import WorkSession from "../models/workSession.model.js";

export const startWorkResetCron = () => {
  // Run at 23:59 everyday
  cron.schedule("59 23 * * *", async () => {
    console.log("🕛 Resetting daily work sessions...");

    try {
      await WorkSession.updateMany(
        {},
        {
          $set: {
            totalSeconds: 0,
            startedAt: new Date(),
            lastActive: null,
            isPaused: true,
          },
        }
      );

      console.log("✅ Daily work time reset done");
    } catch (err) {
      console.error("❌ Work reset failed:", err);
    }
  });
};
