import ActivityLogModel from "../models/activityLog.model.js";

export const getActivityLogs = async (req, res) => {
  try {
    const logs = await ActivityLogModel.find()
      .populate("user", "name role")
      .sort({ createdAt: -1 })
      .limit(1000);

    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
