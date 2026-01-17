import Inventory from "../models/inventory.model.js";
import Order from "../models/order.model.js";
import { createVendor } from "./vendor.controller.js";
import mongoose from "mongoose";

const getStockStatus = (qty, minQty) => {
  if (qty === 0) return "Critical";
  if (qty < minQty) return "Low";
  if (qty > minQty * 2) return "Overstocked";
  return "Healthy";
};

//  CREATE INVENTORY ITEM
export const createInventory = async (req, res) => {
  try {
    const { chairType, color, vendor, quantity, minQuantity } = req.body || {};

    if (
      !chairType ||
      !color ||
      !vendor ||
      quantity === undefined ||
      minQuantity === undefined
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const vendorDoc = await createVendor(vendor);

    const inventory = await Inventory.create({
      chairType,
      color,
      vendor: vendorDoc._id,
      quantity: Number(quantity),
      minQuantity: Number(minQuantity),

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
    const inventory = await Inventory.find({ type: "FULL" }).sort({
      createdAt: -1,
    });

    const data = inventory.map((i) => ({
      ...i.toObject(),
      status: getStockStatus(i.quantity, i.minQuantity),
    }));

    res.status(200).json({
      count: data.length,
      inventory: data,
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
      const vendorDoc = await createVendor(req.body.vendor);
      updateData.vendor = req.body.vendor;
    }

    if (req.body.quantity !== undefined) {
      updateData.quantity = Number(req.body.quantity);
    }

    if (req.body.minQuantity !== undefined) {
      updateData.minQuantity = Number(req.body.minQuantity);
    }

    if (req.body.color !== undefined) {
      updateData.color = req.body.color;
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
      inventory: {
        ...updatedInventory.toObject(),
        status: getStockStatus(
          updatedInventory.quantity,
          updatedInventory.minQuantity
        ),
      },
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
    const { chairType, quantity, location } = req.body;

    if (!chairType || quantity == null || !location) {
      return res.status(400).json({
        success: false,
        message: "chairType, quantity and location are required",
      });
    }

    const qty = Number(quantity);

    // ✅ UPSERT: update if exists, else create
    const sparePart = await Inventory.findOneAndUpdate(
      {
        chairType,
        location,
        type: "SPARE",
      },
      {
        $inc: { quantity: qty },
        $setOnInsert: {
          chairType,
          location,
          type: "SPARE",
          createdBy: req.user ? req.user.id : null,
          createdByRole: req.user ? req.user.role : null,
        },
      },
      {
        new: true,
        upsert: true,
      }
    );

    res.status(201).json({
      success: true,
      message: "Spare part added successfully",
      data: sparePart,
    });
  } catch (error) {
    console.error("Create spare part error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//get all spare parts
export const getSpareParts = async (req, res) => {
  try {
    const parts = await Inventory.find({ type: "SPARE" })
      .populate("createdBy", "name role")
      .sort({ createdAt: -1 });

    res.status(200).json({
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

  if (!chairType || !location || quantity === undefined || quantity === null) {
  return res.status(400).json({
    success: false,
    message: "chairType, location and quantity are required",
  });
}


   const updated = await Inventory.findOneAndUpdate(
  { _id: id, type: "SPARE" },
  { chairType, location, quantity },     // ❌ remove vendor here
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
export const checkInventoryForOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Fetch all SPARE PARTS for this chair model
    const parts = await Inventory.find({
      chairType: order.chairModel,
      type: "SPARE",
    });

    if (parts.length === 0) {
      return res.json({
        chairModel: order.chairModel,
        requiredQuantity: order.quantity,
        totalAvailable: 0,
        parts: [],
      });
    }

    // Group by partName
    const grouped = {};
    parts.forEach((p) => {
      if (!grouped[p.partName]) {
        grouped[p.partName] = 0;
      }
      grouped[p.partName] += p.quantity;
    });

    // Convert to array
    const partList = Object.entries(grouped).map(
      ([partName, available]) => ({
        partName,
        available,
      })
    );

    // Minimum decides how many chairs can be built
    const totalAvailable = Math.min(
      ...partList.map((p) => p.available)
    );

    res.json({
      chairModel: order.chairModel,
      requiredQuantity: order.quantity,
      totalAvailable,
      parts: partList,
    });
  } catch (err) {
    console.error("Inventory check error:", err);
    res.status(500).json({ message: "Inventory check failed" });
  }
};
