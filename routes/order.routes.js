import express from "express";
import {
  createOrder,
  getOrders,
  getOrderById,
  updateOrder,
  deleteOrder,
  updateOrderProgress,
  getOrderByOrderId,
  staffPerformanceAnalytics,
  productAnalytics,
  uploadOrders,
  assignProductionWorker,
  acceptProductionOrder,
  
} from "../controllers/order.controller.js";

// (Optional) JWT middleware
import { protect } from "../middlewares/auth.middleware.js";

import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});
const router = express.Router();


router.post("/", protect, createOrder);
router.get("/", protect, getOrders);
router.post(
  "/upload",
  protect,
  upload.array("files"),
  uploadOrders
);
router.put(
  "/:id/assign-production",
  protect,
  
  assignProductionWorker
);
router.post(
  "/:id/production-accept",
  protect,
  acceptProductionOrder
);


router.get("/analytics/staff", protect, staffPerformanceAnalytics);
router.get("/by-order-id/:orderId", protect, getOrderByOrderId);

router.get("/:id", protect, getOrderById);
router.put("/:id", protect, updateOrder);
router.delete("/:id", protect, deleteOrder);
router.patch("/:id/progress", protect, updateOrderProgress);
router.get("/analytics/products", protect, productAnalytics);


export default router;
