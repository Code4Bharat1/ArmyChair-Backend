import Inventory from "../models/inventory.model.js";
import mongoose from "mongoose";
 //  CREATE INVENTORY ITEM
export const createInventory = async (req, res) => {
  try {
    const { chairType, vendor, quantity } = req.body || {};

    if (!chairType || !vendor || quantity === undefined) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const qty = Number(quantity);

    const inventory = await Inventory.create({
      chairType,
      quantity: qty,
      vendor,

      /* AUTO PRIORITY LOGIC */
      priority: qty < 100 ? "low" : "high",

      createdBy: req.user ? req.user.id : null,
      createdByRole: req.user ? req.user.role : null,
    });

    res.status(201).json({
      message: "Inventory item added successfully",
      inventory,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

 //  GET ALL INVENTORY
export const getAllInventory = async (req, res) => {
  try {
    const inventory = await Inventory.find({ type: "FULL" }).sort({ createdAt: -1 });

    res.status(200).json({
      count: inventory.length,
      inventory,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//   UPDATE INVENTORY
export const updateInventory = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid inventory ID" });
    }

    const updateData = {};

    if (req.body.chairType !== undefined) {
      updateData.chairType = req.body.chairType;
    }
    if (req.body.vendor !== undefined) {
      updateData.vendor = req.body.vendor;
    }

    
    if (req.body.quantity !== undefined) {
      const qty = Number(req.body.quantity);
      updateData.quantity = qty;
      updateData.priority = qty < 100 ? "low" : "high";
    }

    const updatedInventory = await Inventory.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedInventory) {
      return res.status(404).json({ message: "Inventory not found" });
    }

    res.status(200).json({
      message: "Inventory updated successfully",
      inventory: updatedInventory,
    });
  } catch (error) {
    console.error("UPDATE INVENTORY ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

// DELETE INVENTORY
export const deleteInventory = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid inventory ID" });
    }

    const inventory = await Inventory.findByIdAndDelete(req.params.id);

    if (!inventory) {
      return res.status(404).json({ message: "Inventory not found" });
    }

    res.status(200).json({
      message: "Inventory deleted successfully",
      inventory,
    });
  } catch (error) {
    console.error("DELETE INVENTORY ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};


//Spare Parts Inventory

export const createSpareParts = async (req, res) => {
  try {
    const { chairType, vendor, quantity, location } = req.body;

    /* ===== VALIDATION ===== */
    if (
      !chairType ||
      !vendor ||
      quantity === undefined ||
      quantity === null ||
      !location
    ) {
      return res.status(400).json({
        success: false,
        message: "chairType, vendor, quantity and location are required",
      });
    }

    /* ===== CREATE ===== */
    const sparePart = await Inventory.create({
      chairType,
      vendor,
      quantity,
      location,        // 👈 extra field for spare parts
      type: "SPARE",   // ✅ optional: to distinguish from full chair
    });

    return res.status(201).json({
      success: true,
      message: "Spare part added successfully",
      data: sparePart,
    });
  } catch (error) {
    console.error("Create spare part error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

//get all spare parts
export const getSpareParts = async (req, res) => {
  try {
    const parts = await Inventory.find({ type: "SPARE" }).sort({ createdAt: -1 });

    res.status(200).json({
      count: parts.length,
      success: true,
      inventory: parts,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update
export const updateSparePart = async (req, res) => {
  try {
    const { id } = req.params;
    const { chairType, vendor, location, quantity } = req.body;

    if (
      !chairType ||
      !vendor ||
      !location ||
      quantity === undefined ||
      quantity === null
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const updated = await Inventory.findOneAndUpdate(
      { _id: id, type: "SPARE" },
      { chairType, vendor, location, quantity },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Spare part not found",
      });
    }

    res.json({
      success: true,
      message: "Spare part updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error("Update spare part error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete
export const deleteSparePart = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Inventory.findOneAndDelete({
      _id: id,
      type: "SPARE",
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Spare part not found",
      });
    }

    res.json({
      success: true,
      message: "Spare part deleted successfully",
    });
  } catch (error) {
    console.error("Delete spare part error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
