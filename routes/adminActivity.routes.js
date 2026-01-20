import express from "express";
import { getActivityLogs } from "../controllers/activity.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", protect, getActivityLogs);

export default router;
