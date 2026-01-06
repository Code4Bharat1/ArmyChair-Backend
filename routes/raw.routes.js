import express from "express";
import { createRaw, getAllRaw, updateRaw, deleteRaw } from "../controllers/raw.controller.js";
import {protect} from "../middlewares/auth.middleware.js"

const router = express.Router();

router.post("/", protect, createRaw);
router.get("/", protect ,getAllRaw);
router.delete("/delete", protect, deleteRaw);

export default router;


