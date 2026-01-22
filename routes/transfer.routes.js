import express from "express";
import {  transferInventory,getStockMovements } from "../controllers/transfer.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/", protect, transferInventory);

router.get("/stock-movement", protect, getStockMovements);

export default router;
