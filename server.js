import { connectDB } from "./config/db.js";
import authRoutes from "./routes/auth.routes.js";
import inventoryRoutes from "./routes/inventory.routes.js";
import warehouseRoutes from "./routes/warehouse.routes.js";
import cors from "cors";
import express from "express";
import dotenv from "dotenv";
import orderRoutes from "./routes/order.routes.js";
import { apiLimiter, authLimiter } from "./middlewares/rateLimiter.js";
import returnRoutes from "./routes/return.routes.js";
import transferRoutes from "./routes/transfer.routes.js";
import taskRoutes from "./routes/task.routes.js";
import vendorRoutes from "./routes/vendor.routes.js";
import productionRoutes from "./routes/production.routes.js";
import activityRoutes from "./routes/adminActivity.routes.js";
import workTimeRoutes from "./routes/workTime.routes.js";
import activityExportRoutes from "./routes/activityExport.routes.js";
import { startActivityArchiveCron } from "./cron/activityArchive.cron.js";
import { startActivityCleanupCron } from "./cron/activityCleanup.cron.js";
import "./models/vendor.model.js";
import "./models/order.model.js";

dotenv.config();

const PORT = process.env.PORT || 5005;
const app = express();

app.use(cors({
  origin: ["https://armychair.nexcorealliance.com", "https://www.armychair.nexcorealliance.com", "http://localhost:3000"],
  credentials: true,
}));

// 🔥 IMPORTANT FIX
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Khursiwala backend running" });
});

app.use(apiLimiter);   // 👈 protects all APIs


// authentication
app.use("/api/auth", authRoutes);

app.use("/api/inventory", inventoryRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/warehouse", warehouseRoutes);

app.use("/api/returns", returnRoutes);

app.use("/api/transfer", transferRoutes);

// app.use("/api/returns", router);
app.use("/api/auth", authRoutes);

app.use("/api/tasks", taskRoutes);

app.use("/api/vendors", vendorRoutes);
app.use("/api/production", productionRoutes);

app.use("/api/work", workTimeRoutes);

app.use("/activity", activityRoutes);

startActivityArchiveCron();
startActivityCleanupCron();
app.use("/api/activity", activityExportRoutes);
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

connectDB();
