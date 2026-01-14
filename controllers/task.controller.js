import mongoose from "mongoose";
import Task from "../models/task.model.js";
import User from "../models/user.model.js";

/* ================= SUPERADMIN ASSIGN TASK ================= */
export const assignTask = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { department, userId, task } = req.body;

    if (!department || !userId || !task) {
      return res.status(400).json({ message: "All fields required" });
    }

    const user = await User.findOne({
  $or: [
    { _id: mongoose.Types.ObjectId.isValid(userId) ? userId : null },
    { email: userId }
  ]
});

    if (!user) return res.status(404).json({ message: "User not found" });

    const newTask = await Task.create({
      department,
      assignedTo: user._id,
      task,
      assignedBy: new mongoose.Types.ObjectId(req.user.id),

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

    const task = await Task.findOne({
      assignedTo: userId
    }).sort({ createdAt: -1 });   // get latest task

    res.json(task);
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

    const tasks = await Task.find()
      .populate("assignedTo", "name email role")
      .populate("assignedBy", "name");

    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
