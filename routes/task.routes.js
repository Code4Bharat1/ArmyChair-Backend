import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import {
  assignTask,
  getMyTask,
  completeTask,
  getAllTasks,
  getMyTaskHistory,
} from "../controllers/task.controller.js";

const router = express.Router();

router.post("/assign", protect, assignTask);
router.get("/my", protect, getMyTask);
router.put("/complete/:id", protect, completeTask);
router.get("/all", protect, getAllTasks);

router.get("/my/history", protect, getMyTaskHistory);
export default router;
