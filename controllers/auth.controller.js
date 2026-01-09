import User from "../models/User.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

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
      photo,
    } = req.body;

    // 🔎 Check required fields
    if (
      !name ||
      !email ||
      !password ||
      !mobile ||
      !aadharNumber ||
      !dateOfBirth
    ) {
      return res.status(400).json({
        message: "All required fields must be provided",
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
      photo,
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
    const { email, password } = req.body;

    // 🔎 Find user
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // 🔐 Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // 🔑 Create token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    // 🚫 Remove sensitive fields
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

    res.status(200).json({
      message: "Login successful",
      token,
      user: userResponse,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
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
      { role: { $in: ["sales", "warehouse", "fitting"] } },
      {
        password: 0,
        aadharNumber: 0,
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

