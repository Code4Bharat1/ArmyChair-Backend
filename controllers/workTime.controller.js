import WorkSession from "../models/workSession.model.js";
import { logActivity } from "../utils/logActivity.js";

export const startWork = async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    await WorkSession.findOneAndUpdate(
      { user: req.user.id, date: today },
      {
        $set: {
          lastActive: new Date(),
          isPaused: false,
          module: "STAFF_PANEL",
          date: today,
        },
        $setOnInsert: {
          startedAt: new Date(),
          totalSeconds: 0,
        },
      },
      { upsert: true, new: true }
    );

    res.json({ success: true });
  } catch (err) {
    console.error("START WORK ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

export const getDailySummary = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ message: "Date required" });
    }

    const start = new Date(date);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const sessions = await WorkSession.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: "$user",
          totalSeconds: { $sum: "$totalSeconds" },
          module: { $first: "$module" }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user"
        }
      },
      { $unwind: "$user" }
    ]);

    res.json({ success: true, data: sessions });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};


export const tickWork = async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    const session = await WorkSession.findOne({
      user: req.user.id,
      date: today,
    });

    if (!session || session.isPaused)
      return res.json({ success: true });

    session.totalSeconds += 30;
    session.lastActive = new Date();
    await session.save();

    res.json({ success: true });
  } catch (err) {
    console.error("TICK ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};



export const pauseWork = async (req, res) => {
const today = new Date().toISOString().split("T")[0];

const session = await WorkSession.findOne({
  user: req.user.id,
  date: today
});
  if (!session) return res.json({ success: true });

  session.isPaused = true;
  await session.save();

  // 🔥 LOG INTO YOUR EXISTING ACTIVITY LOG
  const hrs = Math.floor(session.totalSeconds / 3600);
  const mins = Math.floor((session.totalSeconds % 3600) / 60);

  // await logActivity(req, {
  //   action: "WORK_TIME",
  //   module: "STAFF_PANEL",
  //   description: `Worked ${hrs}h ${mins}m`,
  // });

  res.json({ success: true });
};
