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
/* ================= CREATE VENDOR (API) ================= */
export const createVendorApi = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Vendor name is required" });
    }

    const vendor = await createVendor(name);

    return res.status(201).json({
      success: true,
      vendor,
    });
  } catch (err) {
    console.error("CREATE VENDOR ERROR:", err.message);

    return res.status(400).json({
      message: err.message || "Failed to create vendor",
    });
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
