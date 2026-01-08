import express from "express";
import {
  createOrder,
  getOrders,
  getOrderById,
  updateOrder,
  deleteOrder,
} from "../controllers/order.controller.js";

// (Optional) JWT middleware
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

/* ================= ROUTES ================= */

// CREATE
router.post("/", createOrder);

// READ ALL
router.get("/", protect, getOrders);

// READ ONE
router.get("/:id", protect, getOrderById);

// UPDATE
router.put("/:id", protect, updateOrder);

// DELETE
router.delete("/:id", protect, deleteOrder);

export default router;
