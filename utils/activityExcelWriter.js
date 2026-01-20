import fs from "fs";
import path from "path";
import XLSX from "xlsx";

export const appendActivityToExcel = (log) => {
  const date = new Date(log.createdAt).toISOString().split("T")[0];
  const folder = path.join(process.cwd(), "exports");

  if (!fs.existsSync(folder)) fs.mkdirSync(folder);

  const filePath = path.join(folder, `activity-${date}.xlsx`);

  let data = [];

  if (fs.existsSync(filePath)) {
    const workbook = XLSX.readFile(filePath);
    const worksheet = workbook.Sheets["Activity"];
    data = XLSX.utils.sheet_to_json(worksheet);
  }

  data.push({
    Time: new Date(log.createdAt).toLocaleString(),
    User: log.userName,
    Role: log.userRole,
    Action: log.action,
    Module: log.module,
    Description: log.description,
  });

  const newWorkbook = XLSX.utils.book_new();
  const newWorksheet = XLSX.utils.json_to_sheet(data);

  XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, "Activity");
  XLSX.writeFile(newWorkbook, filePath);
};
