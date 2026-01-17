import express from "express";
import {
  getOrderPickData,
  dispatchOrderParts,
  getPendingProductionInward,
  acceptProductionInward,
  getOrderInventoryPreview,
  partialAcceptOrder,
} from "../controllers/warehouse.controller.js";

import { protect, warehouseManagerOnly } from "../middlewares/auth.middleware.js";

const router = express.Router();

// existing
router.get("/order/:id/pick-data", protect, warehouseManagerOnly, getOrderPickData);
router.post("/order/dispatch", protect, warehouseManagerOnly, dispatchOrderParts);

// 🔥 NEW — PRODUCTION INWARD FLOW
router.get(
  "/production/inward/pending",
  protect,
  warehouseManagerOnly,
  getPendingProductionInward
);

router.put(
  "/production/inward/:id/accept",
  protect,
  warehouseManagerOnly,
  acceptProductionInward
);
router.get(
  "/order/:orderId/inventory-preview",  
  protect,
  getOrderInventoryPreview
);
router.post("/order/partial-accept", protect, partialAcceptOrder);

export default router;
