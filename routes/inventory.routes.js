import express from "express";
import { createInventory, getAllInventory, deleteInventory, updateInventory} from "../controllers/inventory.controller.js";
import {protect} from "../middlewares/auth.middleware.js"

const router = express.Router();

router.post("/", protect, createInventory);
router.get("/", getAllInventory);
router.delete("/delete/:id", protect, deleteInventory);
router.patch("/update/:id", protect, updateInventory);

export default router;