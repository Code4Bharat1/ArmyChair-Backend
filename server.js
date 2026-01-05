import dotenv from "dotenv";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/auth.routes.js";


dotenv.config();
const PORT = process.env.PORT || 5000;

app.use("/api/auth", authRoutes);
app.use("/api/auth", authRoutes);
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
connectDB();