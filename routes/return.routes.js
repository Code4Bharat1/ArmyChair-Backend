import express from "express";
import {
  createReturn,
  getAllReturns,
  moveReturnToFitting,
} from "../controllers/return.controller.js";
import { fittingDecision } from "../controllers/return.controller.js";
import { protect, returnAccess } from "../middlewares/auth.middleware.js";

const router = express.Router();

/*  All return routes must be protected */
router.use(protect);

/*  Only admin & warehouse can manage returns */
router.use(returnAccess);
router.post("/:id/fitting-decision", fittingDecision);
router.post("/", createReturn);
router.get("/", getAllReturns);
router.post("/:id/move-to-fitting", moveReturnToFitting);


export default router;
