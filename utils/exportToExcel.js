import XLSX from "xlsx";
import fs from "fs";
import path from "path";
import ActivityLog from "../models/activityLog.model.js";

export const exportActivityLogsToExcel = async (date) => {
  const folder = path.join(process.cwd(), "exports");
  if (!fs.existsSync(folder)) fs.mkdirSync(folder);

  // 🟢 Convert to start of day (LOCAL TIME SAFE)
const [year, month, dayPart] = date.split("-");

const start = new Date(
  Number(year),
  Number(month) - 1,
  Number(dayPart),
  0, 0, 0, 0
);

const end = new Date(
  Number(year),
  Number(month) - 1,
  Number(dayPart) + 1,
  0, 0, 0, 0
);

const logs = await ActivityLog.find({
  createdAt: { $gte: start, $lt: end },
}).sort({ createdAt: 1 });

if (!logs.length) return null;

const day = start.toISOString().split("T")[0];

  const filePath = path.join(folder, `activity-${day}.xlsx`);

  const rows = logs.map((l) => ({
    Time: l.createdAt.toLocaleString(),
    User: l.userName,
    Role: l.userRole,
    Action: l.action,
    Module: l.module,
    Description: l.description,
    Source: l.sourceLocation || "",
    Destination: l.destination || "",
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Activity");

  XLSX.writeFile(workbook, filePath);

  return filePath;
};

