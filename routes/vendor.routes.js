import express from "express";
import { getVendors,createVendorApi } from "../controllers/vendor.controller.js";
import { protect } from "../middlewares/auth.middleware.js";


const router = express.Router();

router.get("/", protect, getVendors);
router.post("/", protect, createVendorApi);

export default router;
