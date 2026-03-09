import User from "../models/User.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { verifyCaptcha } from "../utils/captcha.js";
import activityLogModel from "../models/activityLog.model.js";

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
      { role: { $in: ["sales", "warehouse", "fitting","production","admin","user"] } },
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

    // ✅ ADD THIS
    await logActivity(req, {
      action: "PASSWORD_CHANGE",
      module: "Auth",
      entityType: "User",
      entityId: req.user.id,
      description: `${req.user.name || "User"} changed their password`,
    });

    return res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * =========================
 * FORGOT PASSWORD - VERIFY IDENTITY
 * =========================
 */
export const verifyIdentity = async (req, res) => {
  try {
    const { email, aadharNumber, dateOfBirth } = req.body;

    if (!email || !aadharNumber || !dateOfBirth) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "No account found with this email" });
    }

    // Check Aadhar
    if (user.aadharNumber !== aadharNumber) {
      return res.status(400).json({ message: "Aadhar number does not match" });
    }

    // Check DOB (compare date only, ignore time)
    const inputDob = new Date(dateOfBirth).toDateString();
    const storedDob = new Date(user.dateOfBirth).toDateString();

    if (inputDob !== storedDob) {
      return res.status(400).json({ message: "Date of birth does not match" });
    }

    // Issue a short-lived reset token
    const resetToken = jwt.sign(
      { id: user._id, purpose: "reset" },
      process.env.JWT_SECRET,
      { expiresIn: "10m" }
    );

    return res.status(200).json({ message: "Identity verified", resetToken });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * =========================
 * FORGOT PASSWORD - SET NEW PASSWORD
 * =========================
 */
export const resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword)
      return res.status(400).json({ message: "Token and new password are required" });

    if (newPassword.length < 6)
      return res.status(400).json({ message: "Password must be at least 6 characters" });

    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: "Reset session expired. Please try again." });
    }

    if (decoded.purpose !== "reset")
      return res.status(401).json({ message: "Invalid reset token" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.updateOne({ _id: decoded.id }, { $set: { password: hashedPassword } });

    // ✅ ADD THIS — manually log since no req.user exists
    const user = await User.findById(decoded.id).select("name role");
    await activityLogModel.create({
      user: decoded.id,
      userName: user?.name || "Unknown",
      userRole: user?.role || "unknown",
      action: "PASSWORD_RESET",
      module: "Auth",
      entityType: "User",
      entityId: decoded.id,
      description: `${user?.name || "A user"} reset their password via Forgot Password`,
    });

    return res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
/**
 * =========================
 * UPDATE STAFF (ADMIN)
 * =========================
 */
export const updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, mobile, role, dateOfBirth, bloodGroup, photo, aadharNumber, aadharPhotoFront, aadharPhotoBack } = req.body;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "Staff not found" });

    // Check email/aadhar conflict with OTHER users
    if (email && email !== user.email) {
      const exists = await User.findOne({ email, _id: { $ne: id } });
      if (exists) return res.status(400).json({ message: "Email already in use" });
    }
    if (aadharNumber && aadharNumber !== user.aadharNumber) {
      const exists = await User.findOne({ aadharNumber, _id: { $ne: id } });
      if (exists) return res.status(400).json({ message: "Aadhar already in use" });
    }

    const updated = await User.findByIdAndUpdate(
      id,
      { name, email, mobile, role, dateOfBirth, bloodGroup, photo, aadharNumber, aadharPhotoFront, aadharPhotoBack },
      { new: true, runValidators: true, select: "-password" }
    );

    return res.status(200).json({ message: "Staff updated successfully", user: updated });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * =========================
 * DELETE STAFF (ADMIN)
 * =========================
 */
export const deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "Staff not found" });

    await User.findByIdAndDelete(id);
    return res.status(200).json({ message: "Staff deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};