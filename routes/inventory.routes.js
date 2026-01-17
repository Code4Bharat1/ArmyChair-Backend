import express from "express";
import { createInventory,getAllInventory, deleteInventory, updateInventory, createSpareParts
     ,getSpareParts, updateSparePart, deleteSparePart, checkInventoryForOrder,getChairModels} from "../controllers/inventory.controller.js";
import {protect} from "../middlewares/auth.middleware.js"

const router = express.Router();

//Full Chairs
router.post("/",protect, createInventory);
router.get("/", protect,getAllInventory);
router.delete("/delete/:id", protect, deleteInventory);
router.patch("/update/:id", protect, updateInventory);

// Spare Parts 
router.post("/spare-parts", protect ,createSpareParts);
router.get("/spare-parts", getSpareParts);
router.patch("/spare-parts/update/:id", protect, updateSparePart);
router.delete("/spare-parts/delete/:id",protect, deleteSparePart);

router.get(
  "/check-order/:id",
  protect,
  checkInventoryForOrder
);

router.get("/chair-models", protect, getChairModels);

export default router;