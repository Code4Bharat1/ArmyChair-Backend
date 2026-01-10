import express from "express";
import { getMe } from "../controllers/auth.controller.js";;
import { signup, login, getAllStaff  } from "../controllers/auth.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);

// ✅ NEW ROUTE
router.get("/staff", getAllStaff);
router.get("/me",protect, getMe);
export default router;
