import express from "express";
import {
  addProductionInward,
  getProductionInward, // 🔥 IMPORT
} from "../controllers/production.controller.js";

import { protect } from "../middlewares/auth.middleware.js";
import { productionOnly } from "../middlewares/auth.middleware.js";

const router = express.Router();

// CREATE inward
router.post(
  "/inward",
  protect,
  productionOnly,
  addProductionInward
);

router.get(
  "/inward",
  protect,
  productionOnly,
  getProductionInward
);

export default router;
