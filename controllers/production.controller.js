import mongoose from "mongoose";
import User from "../models/User.model.js";
import ProductionInward from "../models/productionInward.model.js";
import { logActivity } from "../utils/logActivity.js";

import Inventory from "../models/inventory.model.js";

/* ================= ADD PRODUCTION INWARD ================= */
export const addProductionInward = async (req, res) => {
  try {
    const { partName, quantity, assignedTo, location } = req.body;

    /* ================= VALIDATIONS ================= */

    if (!partName || !quantity || !location || !assignedTo) {
      return res.status(400).json({
        success: false,
        message: "partName, quantity, location and assignedTo are required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
      return res.status(400).json({
        success: false,
        message: "Invalid warehouse user ID",
      });
    }

    const warehouseUser = await User.findById(assignedTo);

    if (!warehouseUser || warehouseUser.role !== "warehouse") {
      return res.status(400).json({
        success: false,
        message: "Assigned user must be warehouse staff",
      });
    }

    /* ================= CREATE INWARD ================= */

    const inward = await ProductionInward.create({
      partName,
      quantity: Number(quantity),
      location, // 🔥 PRODUCTION LOCATION (VERY IMPORTANT)
      assignedTo,
      createdBy: req.user.id,
      status: "PENDING",
    });

    /* ================= ACTIVITY LOG ================= */

    await logActivity(req, {
      action: "PRODUCTION_INWARD_CREATED",
      module: "Production",
      entityType: "ProductionInward",
      entityId: inward._id,
      description: `Production submitted inward: ${partName} | Qty: ${quantity} | Location: ${location}`,
      sourceLocation: location,
      destination: "Warehouse Approval",
    });

    /* ================= RESPONSE ================= */

    res.status(201).json({
      success: true,
      message: "Stock submitted to warehouse for approval",
      data: inward,
    });
  } catch (err) {
    console.error("ADD PRODUCTION INWARD ERROR:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};


/* ================= GET OWN PRODUCTION INWARDS ================= */
export const getProductionInward = async (req, res) => {
  try {
    const inwards = await ProductionInward.find({
      createdBy: req.user.id,
    })
      .populate("assignedTo", "name role")
      .populate("approvedBy", "name role")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: inwards,
    });
  } catch (err) {
    console.error("FETCH PRODUCTION INWARD ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch production inward records",
    });
  }
};

export const getProductionStock = async (req, res) => {
  try {
    const location = req.query.location;

    if (!location) {
      return res.status(400).json({
        message: "Location is required",
      });
    }

    const stock = await Inventory.find({
      type: "SPARE",
      location,
    }).sort({ partName: 1 });

    res.json({
      success: true,
      data: stock,
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};
