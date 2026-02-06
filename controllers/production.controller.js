import mongoose from "mongoose";
import User from "../models/User.model.js";
import ProductionInward from "../models/productionInward.model.js";
import { logActivity } from "../utils/logActivity.js";

import Inventory from "../models/inventory.model.js";

/* ================= ADD PRODUCTION INWARD ================= */
/* ================= CREATE PRODUCTION REQUEST ================= */
export const addProductionInward = async (req, res) => {
  try {
    const { partName, quantity, location } = req.body;

    if (!partName || !quantity || !location) {
      return res.status(400).json({
        success: false,
        message: "partName, quantity and production location are required",
      });
    }

    const warehouseUser = await User.findOne({ role: "warehouse" });

    if (!warehouseUser) {
      return res.status(400).json({
        success: false,
        message: "No warehouse user found",
      });
    }

    const request = await ProductionInward.create({
      partName,
      quantity: Number(quantity),
      location,
      assignedTo: warehouseUser._id,
      createdBy: req.user.id,
      status: "PENDING",
    });

    res.status(201).json({
      success: true,
      message: "Material request sent to warehouse",
      data: request,
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};


export const acceptProductionInward = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const inward = await ProductionInward.findById(req.params.id).session(session);

    if (!inward || inward.status !== "PENDING") {
      throw new Error("Invalid or already processed request");
    }

    if (String(inward.assignedTo) !== String(req.user.id)) {
      throw new Error("You are not assigned to this request");
    }

    // 1️⃣ Check warehouse stock
    const warehouseStock = await Inventory.findOne({
  partName: inward.partName,
  type: "SPARE",
  location: { $not: /^PROD_/ }, // any non-production location
  quantity: { $gte: inward.quantity },
}).session(session);


    if (!warehouseStock || warehouseStock.quantity < inward.quantity) {
      throw new Error("Not enough stock in warehouse");
    }

    // 2️⃣ Deduct from warehouse
    warehouseStock.quantity -= inward.quantity;
    await warehouseStock.save({ session });

    // 3️⃣ Add to production location
   await Inventory.findOneAndUpdate(
  {
    partName: inward.partName,
    location: inward.location,
    type: "SPARE",
  },
  {
    $inc: { quantity: inward.quantity },
    $setOnInsert: {
      locationType: "PRODUCTION",   // 🔥 THIS WAS MISSING
      type: "SPARE",
      partName: inward.partName,
      location: inward.location,
    },
  },
  {
    upsert: true,
    session,
    runValidators: true,   // extra safety
  }
);


    // 4️⃣ Update request status
    inward.status = "ACCEPTED";
    inward.approvedBy = req.user.id;
    await inward.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.json({
      success: true,
      message: "Material transferred to production successfully",
    });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    res.status(400).json({
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
