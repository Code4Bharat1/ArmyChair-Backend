import { connectDB } from "./config/db.js";
import authRoutes from "./routes/auth.routes.js";
import rawRoutes from "./routes/raw.routes.js";
import cors from "cors";
import express from "express";
import dotenv from "dotenv";

dotenv.config();

const PORT = process.env.PORT || 5000;
const app = express();

app.use(cors({
    origin: "http://localhost:3000",
    credentials: true,
}));
app.use(express.json());
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Khursiwala backend running" });
});

// authentication
app.use("/api/auth", authRoutes);
app.use("/api/auth", authRoutes);

// raw materials
app.use("/api/raw", rawRoutes);


app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
connectDB();