import mongoose from "mongoose";
import User from "../models/User.model.js";
import ProductionInward from "../models/productionInward.model.js";

/* ================= ADD INWARD ================= */
export const addProductionInward = async (req, res) => {
  try {
    const {
      partName,
      quantity,
      // vendor,
      // location,
      // color,
      // type,
      assignedTo,
    } = req.body;

    if (!assignedTo || !mongoose.Types.ObjectId.isValid(assignedTo)) {
      return res.status(400).json({
        message: "Valid warehouse staff must be assigned",
      });
    }

    const warehouseUser = await User.findById(assignedTo);
    if (!warehouseUser || warehouseUser.role !== "warehouse") {
      return res.status(400).json({ message: "Invalid warehouse user" });
    }

    const inward = await ProductionInward.create({
      partName,
      quantity,
      // vendor,
      // location,
      // color,
      // type,
      assignedTo,
      createdBy: req.user.id,
      status: "PENDING",
    });

    res.status(201).json({
      success: true,
      message: "Stock submitted for warehouse approval",
      data: inward,
    });
  } catch (err) {
    console.error("ADD INWARD ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ================= GET OWN INWARDS ================= */
export const getProductionInward = async (req, res) => {
  try {
    const inwards = await ProductionInward.find({
      createdBy: req.user.id,
    })
      .populate("assignedTo", "name")
      .sort({ createdAt: -1 });

    res.status(200).json({ data: inwards });
  } catch (err) {
    console.error("FETCH INWARD ERROR:", err);
    res.status(500).json({
      message: "Failed to fetch production inward records",
    });
  }
};
