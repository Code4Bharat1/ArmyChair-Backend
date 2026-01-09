import express from "express";
import { signup, login, getAllStaff } from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);

// ✅ NEW ROUTE
router.get("/staff", getAllStaff);

export default router;
