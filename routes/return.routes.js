import express from "express";
import {
  createReturn,
  getAllReturns,
  moveReturnToInventory,
} from "../controllers/return.controller.js";

const router = express.Router();

router.post("/", createReturn);
router.get("/", getAllReturns);
router.post("/:id/move-to-inventory", moveReturnToInventory);


export default router;
