import { connectDB } from "./config/db.js";
import authRoutes from "./routes/auth.routes.js";
import inventoryRoutes from "./routes/inventory.routes.js";
import cors from "cors";
import express from "express";
import dotenv from "dotenv";
import orderRoutes from "./routes/order.routes.js";
import router from "./routes/return.routes.js";
import { apiLimiter, authLimiter } from "./middlewares/rateLimiter.js";



dotenv.config();

const PORT = process.env.PORT || 5000;
const app = express();

app.use(cors({
  origin: "http://localhost:3000",
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

app.use("/api/returns", router);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

connectDB();
