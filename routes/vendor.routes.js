import express from "express";
import { getVendors } from "../controllers/vendor.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", protect, getVendors);

export default router;
