import WorkSession from "../models/workSession.model.js";
import { logActivity } from "../utils/logActivity.js";

export const startWork = async (req, res) => {
  const { module } = req.body;

  await WorkSession.findOneAndUpdate(
    { user: req.user.id, module },
    { startedAt: new Date(), lastActive: new Date(), isPaused: false },
    { upsert: true }
  );

  res.json({ success: true });
};

export const tickWork = async (req, res) => {
  const { module } = req.body;

  const session = await WorkSession.findOne({ user: req.user.id, module });
  if (!session || session.isPaused) return res.json({ success: true });

  session.totalSeconds += 30;
  session.lastActive = new Date();
  await session.save();

  res.json({ success: true });
};

export const pauseWork = async (req, res) => {
  const { module } = req.body;

  const session = await WorkSession.findOne({ user: req.user.id, module });
  if (!session) return res.json({ success: true });

  session.isPaused = true;
  await session.save();

  // 🔥 LOG INTO YOUR EXISTING ACTIVITY LOG
  const hrs = Math.floor(session.totalSeconds / 3600);
  const mins = Math.floor((session.totalSeconds % 3600) / 60);

  await logActivity(req, {
    action: "WORK_TIME",
    module,
    description: `Worked ${hrs}h ${mins}m`,
  });

  res.json({ success: true });
};
