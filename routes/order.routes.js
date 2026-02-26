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
  preDispatchEdit,
  partialDispatch,
  assignProductionWorkersPerItem,
  updateItemFitting,
} from "../controllers/order.controller.js";

import { protect } from "../middlewares/auth.middleware.js";
import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

const router = express.Router();

router.post("/", protect, createOrder);
router.get("/", protect, getOrders);

router.post("/upload", protect, upload.array("files"), uploadOrders);

// Analytics (before /:id to avoid conflicts)
router.get("/analytics/staff", protect, staffPerformanceAnalytics);
router.get("/analytics/products", protect, productAnalytics);
router.get("/by-order-id/:orderId", protect, getOrderByOrderId);
router.patch("/:id/item-fitting", protect, updateItemFitting);
// Production
router.put("/:id/assign-production", protect, assignProductionWorker);

// ✅ FIXED: removed extra "/orders" prefix
router.post("/:id/assign-production-items", protect, assignProductionWorkersPerItem);

router.post("/:id/production-accept", protect, acceptProductionOrder);
router.patch("/:id/pre-dispatch-edit", protect, preDispatchEdit);
router.post("/:id/partial-dispatch", protect, partialDispatch);

// Generic CRUD (keep at bottom)
router.get("/:id", protect, getOrderById);
router.put("/:id", protect, updateOrder);
router.delete("/:id", protect, deleteOrder);
router.patch("/:id/progress", protect, updateOrderProgress);

export default router;