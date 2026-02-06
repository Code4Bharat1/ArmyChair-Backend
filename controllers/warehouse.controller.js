import Order from "../models/order.model.js";
import Inventory from "../models/inventory.model.js";
import ProductionInward from "../models/productionInward.model.js";
import mongoose from "mongoose";
import StockMovement from "../models/stockMovement.model.js";

import { logActivity } from "../utils/logActivity.js";
export const getPendingProductionInward = async (req, res) => {
  try {
    const data = await ProductionInward.find({
      status: "PENDING",
      assignedTo: req.user.id, // 🔥 VERY IMPORTANT
    })
      .populate("createdBy", "name") // 🔥 REQUIRED FOR UI
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    console.error("Pending inward error:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

export const getOrderPickData = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });

    const spareStock = await Inventory.find({ type: "SPARE" });

    // group by part name
    const grouped = {};

    for (const item of spareStock) {
      if (!grouped[item.partName]) grouped[item.partName] = [];

      grouped[item.partName].push({
        inventoryId: item._id,
        location: item.location,
        available: item.quantity,
      });
    }


    const parts = Object.keys(grouped).map((partName) => ({
      partName,
      locations: grouped[partName],
    }));

    res.json({
      success: true,
      order,
      parts,
    });
  } catch (err) {
    console.error("Pick Data Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};


export const dispatchOrderParts = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // console.log("REQ BODY:", req.body);

    const { orderId, items } = req.body;

    if (!orderId || !items || !items.length) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid payload" });
    }

    // 1️⃣ Get Order
    const order = await Order.findById(orderId).session(session);
    if (!order) throw new Error("Order not found");

    // 2️⃣ Prevent duplicate warehouse processing
    if (!["ORDER_PLACED", "PARTIAL"].includes(order.progress)) {
      throw new Error("Order already processed by warehouse");
    }

    // 3️⃣ Process each inventory item safely
    for (const item of items) {
      const stock = await Inventory.findById(item.inventoryId).session(session);
      if (!stock) throw new Error(`Inventory not found: ${item.inventoryId}`);

      // Spare vs Full order validation
      if (order.orderType === "SPARE" && stock.type !== "SPARE") {
        throw new Error(`Invalid spare inventory item: ${stock.partName}`);
      }

      if (order.orderType === "FULL" && stock.type === "FULL") {
        throw new Error("Cannot deduct full chair stock for build process");
      }

      // 4️⃣ Atomic stock deduction with race condition protection
      const result = await Inventory.updateOne(
        { _id: item.inventoryId, quantity: { $gte: item.qty } },
        { $inc: { quantity: -item.qty } },
        { session }
      );

      if (result.modifiedCount === 0) {
        throw new Error(`Not enough stock for ${stock.partName}`);
      }
    }

    // 5️⃣ Update order progress
    order.progress = "WAREHOUSE_COLLECTED";
    await order.save({ session });

    // 6️⃣ Commit transaction
    await session.commitTransaction();
    session.endSession();

    // 7️⃣ Activity log
    await logActivity(req, {
      action: "WAREHOUSE_COLLECT",
      module: "Order",
      entityType: "Order",
      entityId: order._id,
      description: `Collected spare parts for order ${order.orderId}`,
    });

    return res.json({
      success: true,
      message: "Parts successfully dispatched to fitting",
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    console.error("Dispatch Error:", err);

    return res.status(400).json({
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

    // 1️⃣ Find warehouse stock (exclude production locations)
    // 1️⃣ Find warehouse stock
    const warehouseStock = await Inventory.findOne({
      partName: {
  $regex: `^${inward.partName}$`,
  $options: "i"
},

      type: "SPARE",
      locationType: "WAREHOUSE",
      quantity: { $gte: inward.quantity }
    })
      .sort({ quantity: -1 })  // take highest stock
      .session(session);


    if (!warehouseStock) throw new Error("Warehouse stock not found");
    if (warehouseStock.quantity < inward.quantity)
      throw new Error("Not enough warehouse stock");

    // 2️⃣ Deduct
    warehouseStock.quantity -= inward.quantity;
    await warehouseStock.save({ session });

    // 3️⃣ Add to production
   await Inventory.findOneAndUpdate(
  {
    partName: {
      $regex: `^${inward.partName}$`,
      $options: "i"
    },
    type: "SPARE",
    location: inward.location,
  },

      {
        $inc: { quantity: inward.quantity },
        $setOnInsert: {
          partName: inward.partName,
          type: "SPARE",
          location: inward.location,
        },
      },
      { upsert: true, session }
    );

    // 4️⃣ Save movement (INSIDE TRANSACTION)
    await StockMovement.create(
      [{
        partName: inward.partName,
        fromLocation: warehouseStock.location,
        toLocation: inward.location,
        quantity: inward.quantity,
        movedBy: req.user.id,
        reason: "TRANSFER",
      }],
      { session }
    );

    // 5️⃣ Update inward
    inward.status = "ACCEPTED";
    inward.approvedBy = req.user.id;
    await inward.save({ session });


    await session.commitTransaction();
    session.endSession();

    await logActivity(req, {
      action: "PRODUCTION_REQUEST_APPROVED",
      module: "Warehouse",
      entityType: "ProductionInward",
      entityId: inward._id,
      description: `Transferred ${inward.quantity} ${inward.partName} to ${inward.location}`,
      sourceLocation: warehouseStock.location,
      destination: inward.location,
    });

    res.json({
      success: true,
      message: "Stock transferred to production",
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



export const getOrderInventoryPreview = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Bill of Materials for the chair
    const bom = await ChairBOM.findOne({ chairModel: order.chairModel });
    if (!bom) {
      return res.status(404).json({
        message: "BOM not defined for this chair model",
      });
    }

    const preview = [];

    for (const part of bom.parts) {
      const inventories = await Inventory.find({
        partName: part.partName,
      });

      const totalAvailable = inventories.reduce(
        (sum, i) => sum + i.quantity,
        0,
      );

      preview.push({
        partName: part.partName,
        requiredPerChair: part.qtyPerChair,
        requiredTotal: part.qtyPerChair * order.quantity,
        totalAvailable,
      });
    }

    res.status(200).json({
      success: true,
      orderId: order.orderId,
      chairModel: order.chairModel,
      quantity: order.quantity,
      parts: preview,
    });
  } catch (error) {
    console.error("INVENTORY PREVIEW ERROR:", error);
    res.status(500).json({ message: "Failed to load inventory preview" });
  }
};
export const partialAcceptOrder = async (req, res) => {
  try {
    const { orderId, buildable, items } = req.body;

    if (!orderId || !items?.length) throw new Error("Invalid partial data");

    const order = await Order.findById(orderId);
    if (!order) throw new Error("Order not found");

    // 🔥 DO NOT TOUCH INVENTORY HERE

    order.partialAccepted = true;
    order.partialBuildableQty = buildable;
    order.partialParts = items;
    order.progress = "PARTIAL";

    await order.save();
    await logActivity(req, {
      action: "PARTIAL_ACCEPT",
      module: "Order",
      entityType: "Order",
      entityId: order._id,
      description: `Partial accepted order ${order.orderId}, buildable qty ${buildable}`,
    });

    res.json({ success: true, message: "Partial saved successfully" });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
