import path from "path";
import fs from "fs";
import jwt from "jsonwebtoken";

/* ================= EXPORT ACTIVITY BY DATE ================= */
export const exportActivityByDate = async (req, res) => {
  try {
    const token =
      req.query.token ||
      req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    try {
      jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: "Invalid token" });
    }

    const { date } = req.params;

    const filePath = path.join(
      process.cwd(),
      "exports",
      `activity-${date}.xlsx`
    );

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        message: "No activity records found for this date",
      });
    }

    return res.download(filePath);
  } catch (err) {
    console.error("EXPORT ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};
