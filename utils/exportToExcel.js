import XLSX from "xlsx";
import fs from "fs";
import path from "path";
import ActivityLog from "../models/activityLog.model.js";

export const exportActivityLogsToExcel = async (date = new Date()) => {
  const folder = path.join(process.cwd(), "exports");
  if (!fs.existsSync(folder)) fs.mkdirSync(folder);

  const day = date.toISOString().split("T")[0];
  const filePath = path.join(folder, `activity-${day}.xlsx`);

  const logs = await ActivityLog.find({})
    .populate("user", "name role")
    .sort({ createdAt: 1 });

  const rows = logs.map(l => ({
    Time: l.createdAt.toLocaleString(),
    User: l.user?.name || "System",
    Role: l.user?.role || "-",
    Action: l.action,
    Module: l.module,
    Description: l.description,
    Source: l.sourceLocation || "",
    Destination: l.destination || ""
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Activity Log");

  XLSX.writeFile(workbook, filePath);

  return filePath;
};
