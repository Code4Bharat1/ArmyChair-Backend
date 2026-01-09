import express from "express";
import { getOrderPickData, dispatchOrderParts } from "../controllers/warehouse.controller.js";

const router = express.Router();

router.get("/order/:id/pick-data", getOrderPickData);
router.post("/order/dispatch", dispatchOrderParts);

export default router;
