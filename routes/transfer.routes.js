import express from "express";
import { getStockMovements, transferStock } from "../controllers/transfer.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/", protect, transferStock );
router.get("/stock-movement", protect, getStockMovements );

export default router;
