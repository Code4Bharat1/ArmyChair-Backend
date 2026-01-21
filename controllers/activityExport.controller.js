import path from "path";
import fs from "fs";
import jwt from "jsonwebtoken";
import XLSX from "xlsx";
import ActivityLogBackup from "../models/activityLogBackup.model.js";

/* ================= EXPORT ACTIVITY BY DATE ================= */
export const exportActivityByDate = async (req, res) => {
  try {
    // 🔐 AUTH (UNCHANGED)
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

    const exportsDir = path.join(process.cwd(), "exports");
    const filePath = path.join(
      exportsDir,
      `activity-${date}.xlsx`
    );

    // ✅ CASE 1: File already exists → just download
    if (fs.existsSync(filePath)) {
      return res.download(filePath);
    }

    // ✅ CASE 2: File deleted → regenerate from MongoDB backup
    const backup = await ActivityLogBackup.findOne({ date });

    if (!backup || !backup.logs || backup.logs.length === 0) {
      return res.status(404).json({
        message: "Activity report expired or not available",
      });
    }

    // 🔄 Recreate Excel from backup data
    const rows = backup.logs.map((log) => ({
      Time: new Date(log.createdAt).toLocaleString(),
      User: log.userName,
      Role: log.userRole,
      Action: log.action,
      Module: log.module,
      Description: log.description,
      Source: log.sourceLocation || "",
      Destination: log.destination || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Activity");

    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir);
    }

    XLSX.writeFile(workbook, filePath);

    // 📥 Download newly generated file
    return res.download(filePath);
  } catch (err) {
    console.error("EXPORT ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};
