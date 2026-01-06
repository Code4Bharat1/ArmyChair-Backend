import Inventory from "../models/inventory.model.js";
import mongoose from "mongoose";
 //  CREATE INVENTORY ITEM
export const createInventory = async (req, res) => {
  try {
    const { chairType, quantity } = req.body || {};

    if (!chairType || quantity === undefined) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const qty = Number(quantity);

    const inventory = await Inventory.create({
      chairType,
      quantity: qty,

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
    const inventory = await Inventory.find().sort({ createdAt: -1 });

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
