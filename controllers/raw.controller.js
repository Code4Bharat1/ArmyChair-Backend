import Raw from "../models/Raw.model.js";
import mongoose from "mongoose";

  // CREATE RAW MATERIAL
export const createRaw = async (req, res) => {
  try {
    const { productName, type, colour, setNo, company } = req.body;

    if ( !productName || !type || !colour || setNo === undefined || !company ) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const raw = await Raw.create({
      productName,
      type,
      colour,
      setNo,
      company,
      createdBy: req.user?.id,
      createdByRole: req.user?.role,
    });

    res.status(201).json({
      message: "Raw material added successfully",
      raw,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// get all raw materials
export const getAllRaw = async (req, res) => {
  try {
    const rawMaterials = await Raw.find().sort({ createdAt: -1 });

      res.status(200).json({
      count: rawMaterials.length,
      rawMaterials,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

 //  UPDATE RAW MATERIAL
export const updateRaw = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin access only" });
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid raw material ID" });
    }

    /* Whitelist allowed fields */
    const allowedFields = [
      "ProductName",
      "type",
      "colour",
      "setNo",
      "company",
      "date",
    ];

    const updateData = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    const updatedRaw = await Raw.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedRaw) {
      return res.status(404).json({ message: "Raw material not found" });
    }

    res.status(200).json({
      message: "Raw material updated successfully",
      raw: updatedRaw,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

   //DELETE RAW MATERIAL
export const deleteRaw = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin access only" });
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid raw material ID" });
    }

    const raw = await Raw.findByIdAndDelete(id);

    if (!raw) {
      return res.status(404).json({ message: "Raw material not found" });
    }

    res.status(200).json({
      message: "Raw material deleted successfully",
      raw,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};