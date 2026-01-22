import mongoose from "mongoose";
import Task from "../models/task.model.js";
import User from "../models/User.model.js";

/* ================= SUPERADMIN ASSIGN TASK ================= */
export const assignTask = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { department, userId, task, dueDate, dueTime } = req.body;

    if (!department || !userId || !task) {
      return res.status(400).json({ message: "All fields required" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Default time → 11:59 PM
    const finalTime = dueTime || "00:05";

    const dueAt = new Date(`${dueDate}T${finalTime}:00`);

    if (dueAt < new Date()) {
      return res.status(400).json({ message: "Due date cannot be in the past" });
    }

    const newTask = await Task.create({
      department,
      assignedTo: user._id,
      task,
      assignedBy: req.user.id,
      dueAt,
    });

    res.status(201).json(newTask);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


/* ================= EMPLOYEE GET OWN TASK ================= */
export const getMyTask = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);

    const tasks = await Task.find({
      assignedTo: userId,
      status: "Pending",
    })
      .populate("assignedBy", "name")
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ================= EMPLOYEE COMPLETE TASK ================= */
export const completeTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) return res.status(404).json({ message: "Task not found" });

    if (task.assignedTo.toString() !== String(req.user.id))
      return res.status(403).json({ message: "Not your task" });

    task.status = "Completed";
    task.completedAt = new Date();
    await task.save();

    res.json({ message: "Task completed" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ================= SUPERADMIN VIEW ALL TASKS ================= */
export const getAllTasks = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const now = new Date();

    await Task.updateMany(
      { status: "Pending", dueAt: { $lt: now } },
      { $set: { isDelayed: true } }
    );

    const tasks = await Task.find()
      .populate("assignedTo", "name email role")
      .populate("assignedBy", "name")
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ================= EMPLOYEE TASK HISTORY ================= */
export const getMyTaskHistory = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);

    const tasks = await Task.find({
      assignedTo: userId,
      status: "Completed",
    }).sort({ completedAt: -1 });

    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
/* ================= ADMIN DELETE TASK ================= */
export const deleteTask = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    await task.deleteOne();

    res.json({ message: "Task deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
