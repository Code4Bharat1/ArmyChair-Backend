import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import {
  assignTask,
  getMyTask,
  completeTask,
  getAllTasks,
} from "../controllers/task.controller.js";

const router = express.Router();

router.post("/assign", protect, assignTask);
router.get("/my", protect, getMyTask);
router.put("/complete/:id", protect, completeTask);
router.get("/all", protect, getAllTasks);

export default router;
