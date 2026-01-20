import Inventory from "../models/inventory.model.js";
import Order from "../models/order.model.js";
import { createVendor } from "./vendor.controller.js";
import mongoose from "mongoose";
import { logActivity } from "../utils/logActivity.js";

const getStockStatus = (qty, minQty) => {
  if (qty === 0) return "Critical";
  if (qty < minQty) return "Low";
  if (qty > minQty * 2) return "Overstocked";
  return "Healthy";
};

//  CREATE INVENTORY ITEM
export const createInventory = async (req, res) => {
  try {
    const { chairType, color, vendor, quantity, minQuantity, location } = req.body || {};

    if (
      !chairType ||
      !color ||
      !vendor ||
      quantity === undefined ||
      minQuantity === undefined ||
      !location
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
      location,
      type: "FULL", // 🔥🔥🔥 THIS IS THE FIX
      createdBy: req.user?.id,
      createdByRole: req.user?.role,
    });

    res.status(201).json({
      message: "Inventory item added successfully",
      inventory,
    });
  } catch (error) {
    console.error("CREATE FULL INVENTORY ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};


//  GET ALL INVENTORY
export const getAllInventory = async (req, res) => {
  try {
    const inventory = await Inventory.find({})
      .populate("vendor", "name")
      .sort({ createdAt: -1 });

    const data = inventory.map((i) => ({
      ...i.toObject(),
      status:
        i.type === "FULL"
          ? getStockStatus(i.quantity, i.minQuantity)
          : "RAW MATERIAL",
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
  updateData.vendor = vendorDoc._id; // ✅ FIXED
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
      { new: true, runValidators: true },
    );

    if (!updatedInventory) {
      return res.status(404).json({ message: "Inventory not found" });
    }
    await logActivity(req, {
      action: "INVENTORY_UPDATE",
      module: "Inventory",
      entityType: "Inventory",
      entityId: updatedInventory._id,
      description: `Updated inventory ${updatedInventory.chairType}`,
    });

    res.status(200).json({
      message: "Inventory updated successfully",
      inventory: {
        ...updatedInventory.toObject(),
        status: getStockStatus(
          updatedInventory.quantity,
          updatedInventory.minQuantity,
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
    await logActivity(req, {
      action: "INVENTORY_DELETE",
      module: "Inventory",
      entityType: "Inventory",
      entityId: inventory._id,
      description: `Deleted inventory ${inventory.chairType}`,
    });

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
    const { partName, quantity, location } = req.body;

    if (!partName || quantity == null || !location) {
      return res.status(400).json({
        message: "partName, quantity and location are required",
      });
    }

    const qty = Number(quantity);

    const sparePart = await Inventory.findOneAndUpdate(
      {
        partName,
        location,
        type: "SPARE",
      },
      {
        $inc: { quantity: qty },
        $setOnInsert: {
          partName,
          location,
          type: "SPARE",
          createdBy: req.user?.id,
          createdByRole: req.user?.role,
        },
      },
      { new: true, upsert: true }
    );

    res.status(201).json({
      success: true,
      message: "Spare part added successfully",
      data: sparePart,
    });
  } catch (error) {
    console.error("Create spare part error:", error);
    res.status(500).json({ message: error.message });
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
    const { partName, location, quantity } = req.body;

    if (!partName || !location || quantity == null) {
      return res.status(400).json({
        message: "partName, location and quantity are required",
      });
    }

    const updated = await Inventory.findOneAndUpdate(
      { _id: req.params.id, type: "SPARE" },
      {
        partName,
        location,
        quantity: Number(quantity),
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Spare part not found" });
    }

    res.json({
      success: true,
      message: "Spare part updated successfully",
      data: updated,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
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

    // ✅ FIXED LOGGING
    await logActivity(req, {
      action: "DELETE_SPARE_PART",
      module: "Inventory",
      entityType: "Inventory",
      entityId: deleted._id,
      description: `Deleted spare part ${deleted.chairType} from ${deleted.location}`,
      sourceLocation: deleted.location,
      destination: "DELETED",
    });

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

    /* ================= SPARE ORDER ================= */
    if (order.orderType === "SPARE") {
      const spare = await Inventory.findOne({
        partName: order.chairModel,
        type: "SPARE",
      });

      return res.json({
        orderType: "SPARE",
        partName: order.chairModel,
        requiredQuantity: order.quantity,
        available: spare?.quantity || 0,
      });
    }

    /* ================= FULL ORDER ================= */
    const parts = await Inventory.find({
      chairType: order.chairModel,
      type: "SPARE",
    });

    if (parts.length === 0) {
      return res.json({
        orderType: "FULL",
        chairModel: order.chairModel,
        requiredQuantity: order.quantity,
        totalAvailable: 0,
        parts: [],
      });
    }

    const grouped = {};
    parts.forEach((p) => {
      if (!grouped[p.partName]) {
        grouped[p.partName] = 0;
      }
      grouped[p.partName] += p.quantity;
    });

    const partList = Object.entries(grouped).map(
      ([partName, available]) => ({
        partName,
        available,
      })
    );

    const totalAvailable = Math.min(
      ...partList.map((p) => p.available)
    );

    res.json({
      orderType: "FULL",
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

export const getChairModels = async (req, res) => {
  try {
    const models = await Inventory.find({ type: "FULL" }).distinct("chairType");
    res.json({ models });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
export const getSparePartNames = async (req, res) => {
  try {
    const parts = await Inventory
      .find({ type: "SPARE" })
      .distinct("partName");

    res.json({ parts });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
