import express from "express";
import {
  createReturn,
  getAllReturns,
  moveReturnToFitting,
  moveReturnToInventory,
  moveSpareReturnToInventory,
  fittingDecision,
  getAllBadReturns,
} from "../controllers/return.controller.js";
import { protect, returnAccess } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(protect);
router.use(returnAccess);

router.post("/", createReturn);
router.get("/", getAllReturns);
router.post("/:id/move-to-fitting", moveReturnToFitting);
router.post("/:id/move-to-inventory", moveReturnToInventory);
router.post("/:id/move-spare-to-inventory", moveSpareReturnToInventory);  // ✅ fixed
router.post("/:id/fitting-decision", fittingDecision);
router.get("/bad-returns", getAllBadReturns);

export default router;
