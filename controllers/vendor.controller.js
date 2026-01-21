import Vendor from "../models/vendor.model.js";
import mongoose from "mongoose";

/* ================= GET ALL VENDORS ================= */
export const getVendors = async (req, res) => {
  try {
    const vendors = await Vendor.find({ isActive: true }).sort({ name: 1 });
    return res.json(vendors);
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch vendors" });
  }
};

/* ================= CREATE VENDOR IF NOT EXISTS ================= */
// ⚠️ INTERNAL UTILITY — DO NOT USE DIRECTLY FROM ROUTES
export const createVendor = async (name) => {
  if (!name) {
    throw new Error("Vendor name is required");
  }

  // ❌ Prevent ObjectId misuse
  if (mongoose.Types.ObjectId.isValid(name)) {
    throw new Error("Invalid vendor name");
  }

  const normalized = name.trim().toUpperCase();

  let vendor = await Vendor.findOne({ name: normalized });

  if (!vendor) {
    vendor = await Vendor.create({
      name: normalized,
      isActive: true,
    });
  }

  return vendor;
};
