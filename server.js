import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import { apiLimiter } from "./middlewares/rateLimiter.js";

// ROUTES
import authRoutes from "./routes/auth.routes.js";
import inventoryRoutes from "./routes/inventory.routes.js";
import warehouseRoutes from "./routes/warehouse.routes.js";
import orderRoutes from "./routes/order.routes.js";
import returnRoutes from "./routes/return.routes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5005;

/* ================= MIDDLEWARE ================= */

app.use(cors({
  origin: [
    "https://armychair.nexcorealliance.com",
    "https://www.armychair.nexcorealliance.com",
    "http://localhost:3000",
  ],
  credentials: true,
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Global API rate limiter
app.use(apiLimiter);

/* ================= HEALTH ================= */

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "ok",
    message: "Khursiwala backend running",
  });
});

/* ================= ROUTES ================= */

app.use("/api/auth", authRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/warehouse", warehouseRoutes);
app.use("/api/returns", returnRoutes);

/* ================= START SERVER ================= */

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

/* ================= DB ================= */

connectDB();
