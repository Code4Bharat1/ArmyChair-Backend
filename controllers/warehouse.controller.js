import Order from "../models/order.model.js";
import Inventory from "../models/inventory.model.js";
import ProductionInward from "../models/productionInward.model.js";
import mongoose from "mongoose";
import Vendor from "../models/vendor.model.js";
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
    const { orderId, items } = req.body;

    if (!orderId || !items || !items.length) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid payload" });
    }

    const order = await Order.findById(orderId).session(session);
    if (!order) throw new Error("Order not found");

    if (!["ORDER_PLACED", "PARTIAL"].includes(order.progress)) {
      throw new Error("Order already processed by warehouse");
    }

    for (const item of items) {
      const stock = await Inventory.findById(item.inventoryId).session(session);

     if (!stock) {
  throw new Error("Inventory not found");
}

// If it's a spare order → must use SPARE items
if (order.orderType === "SPARE" && stock.type !== "SPARE") {
  throw new Error("Invalid spare inventory item");
}

// If it's a full order → allow chair components
if (order.orderType === "FULL" && stock.type === "FULL") {
  throw new Error("Cannot deduct full chair stock for build process");
}


      if (stock.quantity < item.qty) {
        throw new Error(
          `Not enough stock at ${stock.location} for ${stock.chairType}`,
        );
      }

      stock.quantity -= item.qty;
      await stock.save({ session });
    }

    order.progress = "WAREHOUSE_COLLECTED";
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();
await logActivity(req, {
  action: "WAREHOUSE_COLLECT",
  module: "Order",
  entityType: "Order",
  entityId: order._id,
  description: `Collected spare parts for order ${order.orderId}`,
});

    res.json({ success: true, message: "Parts sent to fitting" });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    console.error("Dispatch Error:", err);
    res.status(400).json({ success: false, message: err.message });
  }
};

export const acceptProductionInward = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const inward = await ProductionInward.findById(req.params.id).session(
      session,
    );

    if (!inward || inward.status !== "PENDING") {
      throw new Error("Invalid or already processed inward");
    }

    if (String(inward.assignedTo) !== String(req.user.id)) {
      throw new Error("You are not assigned to this inward");
    }

    /* ================= SYSTEM VENDOR ================= */
    let vendor = await Vendor.findOne({ name: "Production" }).session(session);
    if (!vendor) {
      vendor = await Vendor.create([{ name: "Production" }], { session });
    }

    /* ================= ADD / MERGE SPARE INVENTORY ================= */
    await Inventory.findOneAndUpdate(
  {
    partName: inward.partName, // ✅ FIXED
    location: inward.location || "A",
    type: "SPARE",
  },
  {
    $inc: { quantity: inward.quantity },
    $setOnInsert: {
      partName: inward.partName, // ✅ MUST SET
      type: "SPARE",
      location: inward.location || "A",
      createdBy: inward.createdBy,
      createdByRole: "production",
      maxQuantity: 0,
    },
  },
  { upsert: true, new: true, session },
);


    /* ================= UPDATE INWARD ================= */
    inward.status = "ACCEPTED";
    inward.approvedBy = req.user.id;
    await inward.save({ session });

    await session.commitTransaction();
    session.endSession();
    await logActivity(req, {
      action: "PRODUCTION_INWARD_ACCEPTED",
      module: "Warehouse",
      entityType: "ProductionInward",
      entityId: inward._id,
      description: `Accepted production inward ${inward.partName} qty ${inward.quantity}`,
      sourceLocation: "Production",
      destination: "Warehouse",
    });

    res.json({
      success: true,
      message: "Inventory added successfully",
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
