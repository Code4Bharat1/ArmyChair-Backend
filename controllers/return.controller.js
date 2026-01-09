import Return from "../models/return.model.js";
import Inventory from "../models/inventory.model.js";

/**
 * CREATE RETURN ORDER
 * POST /api/returns
 */
export const createReturn = async (req, res) => {
  try {
    const {
      orderId,
      chairType,
      description,
      quantity,
      returnDate,
      category,
      vendor,
      location,
    } = req.body;

    if (!orderId || !chairType || !returnDate || !category || !vendor) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    const exists = await Return.findOne({ orderId });
    if (exists) {
      return res.status(409).json({ message: "Return order already exists" });
    }

    const returnItem = await Return.create({
      orderId,
      chairType,
      description,
      quantity,
      returnDate,
      category,
      vendor,
      location,
    });

    res.status(201).json({
      message: "Return order added successfully",
      data: returnItem,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET ALL RETURNS
 * GET /api/returns
 */
export const getAllReturns = async (req, res) => {
  try {
    const returns = await Return.find().sort({ createdAt: -1 });
    res.status(200).json({data:returns,});
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * MOVE RETURN TO INVENTORY
 * POST /api/returns/:id/move-to-inventory
 */
export const moveReturnToInventory = async (req, res) => {
  try {
    const returnItem = await Return.findById(req.params.id);

    if (!returnItem) {
      return res.status(404).json({ message: "Return item not found" });
    }

    if (returnItem.movedToInventory) {
      return res.status(400).json({ message: "Already moved to inventory" });
    }

    // ✅ BLOCK non-functional items
    if (returnItem.category !== "Functional") {
      return res.status(400).json({
        message: "Only Functional items can be moved to inventory",
      });
    }

    await Inventory.create({
      chairType: returnItem.chairType,
      quantity: returnItem.quantity,
      vendor: returnItem.vendor,
      location: returnItem.location,
      type: "FULL",
      priority: "high",
    });

    returnItem.movedToInventory = true;
    await returnItem.save();

    res.status(200).json({
      message: "Moved to inventory successfully",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

