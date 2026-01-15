import express from "express";
import {
  createOrder,
  getOrders,
  getOrderById,
  updateOrder,
  deleteOrder,
  updateOrderProgress,
  getOrderByOrderId,
} from "../controllers/order.controller.js";

// (Optional) JWT middleware
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();


router.post("/" , protect, createOrder);

router.get("/", protect, getOrders);

router.get("/by-order-id/:orderId", protect, getOrderByOrderId);

router.get("/:id", protect, getOrderById);

router.put("/:id", protect, updateOrder);

router.delete("/:id", protect, deleteOrder);

router.patch("/:id/progress", protect, updateOrderProgress);
export default router;
