import express from "express";
import { startWork, tickWork, pauseWork } from "../controllers/workTime.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/start", protect, startWork);
router.post("/tick", protect, tickWork);
router.post("/pause", protect, pauseWork);

export default router;
