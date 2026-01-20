import ActivityLog from "../models/activityLog.model.js";
import { appendActivityToExcel } from "./activityExcelWriter.js";
import User from "../models/User.model.js";

export const logActivity = async (req, payload) => {
  if (!req.user?.id) {
    console.error("logActivity called without req.user.id");
    return;
  }

  // ✅ ENSURE name & role ALWAYS EXIST
  let userName = req.user.name;
  let userRole = req.user.role;

  if (!userName || !userRole) {
    const user = await User.findById(req.user.id).select("name role");
    userName = user?.name || "Unknown";
    userRole = user?.role || "Unknown";
  }

  const log = await ActivityLog.create({
    user: req.user.id,
    userName,
    userRole,
    action: payload.action,
    module: payload.module,
    entityType: payload.entityType,
    entityId: payload.entityId,
    description: payload.description,
    sourceLocation: payload.sourceLocation,
    destination: payload.destination,
  });

  // 🔥 Excel archive (PERMANENT)
  await appendActivityToExcel({
    createdAt: log.createdAt,
    action: log.action,
    module: log.module,
    description: log.description,
    userName,
    userRole,
  });

  return log;
};
