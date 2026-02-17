import User from "../models/User.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { verifyCaptcha } from "../utils/captcha.js";

const loginAttempts = new Map();

/**
 * =========================
 * SIGNUP CONTROLLER
 * =========================
 */
export const signup = async (req, res) => {
  try {
    console.log("REQ BODY:", req.body);
    const {
  name,
  email,
  password,
  role,
  mobile,
  aadharNumber,
  dateOfBirth,
  bloodGroup,
  photo,
  aadharPhotoFront,
  aadharPhotoBack,
} = req.body;


    // 🔎 Check required fields
    if (
  !name ||
  !email ||
  !password ||
  !mobile ||
  !aadharNumber ||
  !dateOfBirth ||
  !aadharPhotoFront ||
  !aadharPhotoBack ||
  !bloodGroup
) {
  return res.status(400).json({
    message: "All required fields including Aadhar photos must be provided",
  });
}

    // 🔎 Check if user already exists
    const userExists = await User.findOne({
      $or: [{ email }, { aadharNumber }],
    });

    if (userExists) {
      return res.status(400).json({
        message: "User already exists with this email or Aadhar",
      });
    }

    // 🔐 Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 🧾 Create user
    await User.create({
  name,
  email,
  password: hashedPassword,
  role,
  mobile,
  aadharNumber,
  dateOfBirth,
  bloodGroup,
  photo,
  aadharPhotoFront,
  aadharPhotoBack,
});


    res.status(201).json({
      message: "Signup successful",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

/**
 * =========================
 * LOGIN CONTROLLER
 * =========================
 */
export const login = async (req, res) => {
  try {
    const { email, password, captchaId, captchaValue } = req.body;
    const ip = req.ip;

    // 🔢 Count attempts FIRST
    const attempts = (loginAttempts.get(ip) || 0) + 1;
    loginAttempts.set(ip, attempts);

    setTimeout(() => loginAttempts.delete(ip), 15 * 60 * 1000);

    console.log("Login attempts:", ip, attempts);

    // 🤖 CAPTCHA CHECK (if required)
    if (attempts >= 3) {
      if (!captchaId || !captchaValue) {
        return res.status(400).json({
          message: "Captcha required",
          requireCaptcha: true,
        });
      }

      const ok = verifyCaptcha(captchaId, captchaValue);
      if (!ok) {
        return res.status(400).json({
          message: "Invalid captcha",
          requireCaptcha: true,
        });
      }
    }

    // 🔎 Find user
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(400).json({
        message: "Email not found",
        requireCaptcha: attempts >= 3,
      });
    }

    // 🔐 Check password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Incorrect password",
        requireCaptcha: attempts >= 3,
      });
    }

    // ✅ SUCCESS → reset attempts
    loginAttempts.delete(ip);

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      mobile: user.mobile,
      photo: user.photo,
      dateOfBirth: user.dateOfBirth,
      createdAt: user.createdAt,
    };

    return res.status(200).json({
      message: "Login successful",
      token,
      user: userResponse,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};


/**
 * =========================
 * GET ALL STAFF (ADMIN)
 * =========================
 */
export const getAllStaff = async (req, res) => {
  try {
    const staff = await User.find(
      { role: { $in: ["sales", "warehouse", "fitting","production"] } },
      {
        password: 0,
        __v: 0,
      }
    ).sort({ createdAt: -1 });

    res.status(200).json(staff);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      user
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};
export const changePassword = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.updateOne(
      { _id: req.user.id },
      { $set: { password: hashedPassword } }
    );

    return res.status(200).json({
      message: "Password updated successfully",
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

