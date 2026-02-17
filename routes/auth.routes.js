import express from "express";
import {
  signup,
  login,
  getAllStaff,
  getMe,
  changePassword,
} from "../controllers/auth.controller.js";
import { createCaptcha } from "../utils/captcha.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.get("/staff", getAllStaff);
router.get("/me", protect, getMe);

/* ✅ ADD THIS */
router.put("/change-password", protect, changePassword);
router.get("/captcha", (req, res) => {
  const captcha = createCaptcha();
  res.json(captcha);
});

export default router;
