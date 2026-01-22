import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { connectDB } from "./config/db.js";

// routes
import authRoutes from "./routes/auth.routes.js";
import inventoryRoutes from "./routes/inventory.routes.js";
import warehouseRoutes from "./routes/warehouse.routes.js";
import orderRoutes from "./routes/order.routes.js";
import returnRoutes from "./routes/return.routes.js";
import transferRoutes from "./routes/transfer.routes.js";
import taskRoutes from "./routes/task.routes.js";
import vendorRoutes from "./routes/vendor.routes.js";
import productionRoutes from "./routes/production.routes.js";
import activityRoutes from "./routes/adminActivity.routes.js";
import workTimeRoutes from "./routes/workTime.routes.js";
import activityExportRoutes from "./routes/activityExport.routes.js";
import notificationRoutes from "./routes/notification.routes.js";

// middleware
import { apiLimiter } from "./middlewares/rateLimiter.js";

// cron (ONLY ONE)
import { startActivityArchiveCron } from "./cron/activityArchive.cron.js";

// preload models (keep)
import "./models/vendor.model.js";
import "./models/order.model.js";

dotenv.config();

const PORT = process.env.PORT || 5005;
const app = express();

// CORS
app.use(
  cors({
    origin: [
      "https://armychair.nexcorealliance.com",
      "https://www.armychair.nexcorealliance.com",
      "http://localhost:3000",
    ],
    credentials: true,
  })
);

// body limits
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Khursiwala backend running" });
});

// rate limit
app.use(apiLimiter);

// routes
app.use("/api/auth", authRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/warehouse", warehouseRoutes);
app.use("/api/returns", returnRoutes);
app.use("/api/transfer", transferRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/vendors", vendorRoutes);
app.use("/api/production", productionRoutes);
app.use("/api/work", workTimeRoutes);
app.use("/activity", activityRoutes);
app.use("/api/activity", activityExportRoutes);
app.use("/api/notifications", notificationRoutes);

// ✅ START CRON (ONLY ONCE)
startActivityArchiveCron();

// server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// db
connectDB();
