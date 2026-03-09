import express from "express";
import {
  signup,
  login,
  getAllStaff,
  getMe,
  changePassword,
  verifyIdentity,
  resetPassword,
  updateStaff,
  deleteStaff,
} from "../controllers/auth.controller.js";
import { createCaptcha } from "../utils/captcha.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.get("/staff", getAllStaff);
router.get("/me", protect, getMe);
router.put("/staff/:id", protect, updateStaff);
router.delete("/staff/:id", protect, deleteStaff);

router.post("/forgot-password/verify", verifyIdentity);
router.post("/forgot-password/reset", resetPassword);
router.put("/change-password", protect, changePassword);
router.get("/captcha", (req, res) => {
  const captcha = createCaptcha();
  res.json(captcha);
});

export default router;
