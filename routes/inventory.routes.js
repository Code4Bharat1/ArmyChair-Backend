import express from "express";
import { createInventory, getAllInventory, deleteInventory, updateInventory, createSpareParts ,getSpareParts, updateSparePart, deleteSparePart} from "../controllers/inventory.controller.js";
import {protect} from "../middlewares/auth.middleware.js"

const router = express.Router();

//Full Chairs
router.post("/", protect, createInventory);
router.get("/", getAllInventory);
router.delete("/delete/:id", protect, deleteInventory);
router.patch("/update/:id", protect, updateInventory);

// Spare Parts 
router.post("/spare-parts", createSpareParts);
router.get("/spare-parts", getSpareParts);
router.patch("/spare-parts/update/:id", updateSparePart);
router.delete("/spare-parts/delete/:id", deleteSparePart);
export default router;