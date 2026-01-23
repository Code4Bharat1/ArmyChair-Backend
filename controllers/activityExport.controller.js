import path from "path";
import fs from "fs";
import jwt from "jsonwebtoken";
import XLSX from "xlsx";
import ActivityLogBackup from "../models/activityLogBackup.model.js";
import { exportActivityLogsToExcel } from "../utils/exportToExcel.js";


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

    const exportsDir = path.join(process.cwd(), "exports");
    const filePath = path.join(exportsDir, `activity-${date}.xlsx`);

    // ✅ CASE 1: File already exists
    if (fs.existsSync(filePath)) {
      return res.download(filePath);
    }

    // ✅ CASE 2: Generate from LIVE logs (IMPORTANT FIX)
    const generatedFile = await exportActivityLogsToExcel(date);

    if (generatedFile) {
      return res.download(generatedFile);
    }

    // ✅ CASE 3: Try backup (for archived days)
    const backup = await ActivityLogBackup.findOne({ date });

    if (backup && backup.logs && backup.logs.length > 0) {
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

      if (!fs.existsSync(exportsDir)) {
        fs.mkdirSync(exportsDir);
      }

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Activity");

      XLSX.writeFile(workbook, filePath);

      return res.download(filePath);
    }

    return res.status(404).json({
      message: "No activity records found for selected date",
    });

  } catch (err) {
    console.error("EXPORT ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

