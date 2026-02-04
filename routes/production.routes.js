import express from "express";
import {
  addProductionInward,
  getProductionInward, 
  getProductionStock
} from "../controllers/production.controller.js";


import { protect } from "../middlewares/auth.middleware.js";
import { productionOnly } from "../middlewares/auth.middleware.js";

const router = express.Router();

// CREATE inward
router.post(
  "/inward",
  protect,
  
  addProductionInward
);

router.get(
  "/inward",
  protect,
  
  getProductionInward
);
router.get(
  "/stock",
  protect,
  
  getProductionStock
);

export default router;
