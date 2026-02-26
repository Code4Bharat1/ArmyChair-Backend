import Order from "../models/order.model.js";
import Inventory from "../models/inventory.model.js";
import ProductionInward from "../models/productionInward.model.js";
import mongoose from "mongoose";
import StockMovement from "../models/stockMovement.model.js";
import User from "../models/User.model.js";
import { logActivity } from "../utils/logActivity.js";
// =====================================================
// ADD THIS FUNCTION to your warehouse.controller.js
// (or wherever your production inward create route points)
// This is the POST /production/inward handler
// =====================================================
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const createProductionInward = async (req, res) => {
  try {
    const { partName, quantity, location, remark } = req.body;

    if (!partName || !quantity || !location) {
      return res.status(400).json({
        success: false,
        message: "partName, quantity and location are required",
      });
    }

    // ✅ Find a warehouse user to assign to
    const warehouseUser = await User.findOne({ role: "warehouse" });
    if (!warehouseUser) {
      return res.status(400).json({
        success: false,
        message: "No warehouse staff available to handle this request",
      });
    }

    const inward = await ProductionInward.create({
      partName: partName.trim(),
      quantity: Number(quantity),
      location: location.trim(),
      remark: remark?.trim() || "",
      createdBy: req.user.id,
      assignedTo: warehouseUser._id, // ✅ Required field now set
      status: "PENDING",
    });

    res.status(201).json({
      success: true,
      message: "Request sent to warehouse",
      data: inward,
    });

  } catch (err) {
    console.error("Create production inward error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};


// =====================================================
// ALSO UPDATE getPendingProductionInward to return remark
// Replace your existing getPendingProductionInward with this:
// =====================================================

export const getPendingProductionInward = async (req, res) => {
  try {
    const data = await ProductionInward.find({
      status: "PENDING",
      assignedTo: req.user.id,
    })
      .populate("createdBy", "name")
      .sort({ createdAt: -1 });

    // remark is already on the document, no extra change needed
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
// export const getPendingProductionInward = async (req, res) => {
//   try {
//     const data = await ProductionInward.find({
//       status: "PENDING",
//       assignedTo: req.user.id, // 🔥 VERY IMPORTANT
//     })
//       .populate("createdBy", "name") // 🔥 REQUIRED FOR UI
//       .sort({ createdAt: -1 });

//     res.json({
//       success: true,
//       data,
//     });
//   } catch (err) {
//     console.error("Pending inward error:", err);
//     res.status(500).json({
//       success: false,
//       message: err.message,
//     });
//   }
// };

export const getOrderPickData = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // ✅ FETCH ONLY WAREHOUSE STOCK (case-insensitive safe)
    const spareStock = await Inventory.find({
      type: "SPARE",
      locationType: "WAREHOUSE",
      quantity: { $gt: 0 },
    });

    /**
     * Group by NORMALIZED part name
     * key = lowercase trimmed name
     * value keeps original casing for UI
     */
    const grouped = {};

    for (const item of spareStock) {
      const key = item.partName.trim().toLowerCase(); // 🔥 FIX

      if (!grouped[key]) {
        grouped[key] = {
          partName: item.partName, // preserve casing for UI
          locations: [],
        };
      }

      grouped[key].locations.push({
        inventoryId: item._id,
        location: item.location,
        available: item.quantity,
        locationType: item.locationType,
      });
    }

    const parts = Object.values(grouped);

    res.json({
      success: true,
      order,
      parts,
    });
  } catch (err) {
    console.error("Pick Data Error:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
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

  if (order.orderType === "SPARE") {
  order.progress = "READY_FOR_DISPATCH";
} else {
  order.progress = "WAREHOUSE_COLLECTED";
}
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
// =====================================================
// 1. ADD THIS TEMPORARY DEBUG ROUTE to your warehouse routes
//    GET /warehouse/debug/inventory/:partName
//    Use it to see exactly what MongoDB has for that item
// =====================================================

export const debugInventorySearch = async (req, res) => {
  try {
    const { partName } = req.params;
    const nameRegex = { $regex: `^${escapeRegex(partName.trim())}$`, $options: "i" };

    // Search ALL inventory records matching this name in any field
    const allMatches = await Inventory.find({
      $or: [
        { partName: nameRegex },
        { chairType: nameRegex },
      ],
    }).lean();

    // Also search WAREHOUSE specifically
    const warehouseMatches = await Inventory.find({
      $or: [
        { partName: nameRegex },
        { chairType: nameRegex },
      ],
      locationType: "WAREHOUSE",
    }).lean();

    res.json({
      searchedFor: partName,
      totalFound: allMatches.length,
      warehouseFound: warehouseMatches.length,
      allRecords: allMatches.map((i) => ({
        _id:          i._id,
        partName:     i.partName,
        chairType:    i.chairType,
        type:         i.type,
        location:     i.location,
        locationType: i.locationType,
        quantity:     i.quantity,
      })),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
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

    // ── Ownership check ──────────────────────────────────────────
    // Only enforce if assignedTo is actually set on the record
    if (inward.assignedTo && String(inward.assignedTo) !== String(req.user.id)) {
      throw new Error("You are not assigned to this request");
    }

   const searchName = inward.partName.trim();
const nameRegex  = { $regex: `^${escapeRegex(searchName)}$`, $options: "i" };

    // ── Find warehouse stock ─────────────────────────────────────
    // Search by chairType OR partName (covers both FULL and SPARE)
    // Exclude stock already sitting in PRODUCTION or FITTING locations
    let warehouseStock = await Inventory.findOne({
      $or: [
        { partName:  nameRegex },
        { chairType: nameRegex },
      ],
      locationType: { $nin: ["PRODUCTION", "FITTING"] },
      quantity: { $gte: inward.quantity },
    })
      .sort({ quantity: -1 })
      .session(session);

    // ── Fallback: try partial / trimmed name match ───────────────
    if (!warehouseStock) {
      const partialRegex = { $regex: escapeRegex(searchName), $options: "i" };
      warehouseStock = await Inventory.findOne({
        $or: [
          { partName:  partialRegex },
          { chairType: partialRegex },
        ],
        locationType: { $nin: ["PRODUCTION", "FITTING"] },
        quantity: { $gte: inward.quantity },
      })
        .sort({ quantity: -1 })
        .session(session);
    }

    if (!warehouseStock) {
      // Give a helpful error showing what was searched
      const allRecords = await Inventory.find({
        $or: [
          { partName:  { $regex: searchName, $options: "i" } },
          { chairType: { $regex: searchName, $options: "i" } },
        ],
      }).lean();

      const debugInfo = allRecords.length
        ? `Found ${allRecords.length} partial match(es) but none at WAREHOUSE with qty ≥ ${inward.quantity}: ` +
          allRecords.map((r) => `[${r.partName || r.chairType} | ${r.locationType} | qty:${r.quantity}]`).join(", ")
        : `No inventory records found matching "${searchName}" in any field or location`;

      throw new Error(debugInfo);
    }

    // ── Deduct from source stock ─────────────────────────────────
    warehouseStock.quantity -= inward.quantity;
    await warehouseStock.save({ session });

    // ── Determine destination locationType ──────────────────────
    const targetLocationType =
      inward.location.startsWith("PROD_")
        ? "PRODUCTION"
        : inward.location.startsWith("FIT_") || inward.location === "FITTING_SECTION"
        ? "FITTING"
        : "WAREHOUSE";

    // ── Add to destination ───────────────────────────────────────
    // Use the same field name that exists on the source record
    const destFieldName  = warehouseStock.chairType ? "chairType" : "partName";
    const destFieldValue = warehouseStock.chairType || warehouseStock.partName;

    await Inventory.findOneAndUpdate(
      { [destFieldName]: { $regex: `^${escapeRegex(destFieldValue.trim())}$`, $options: "i" }, location: inward.location },
      {
        $inc: { quantity: inward.quantity },
        $setOnInsert: {
          [destFieldName]: destFieldValue,
          type:            warehouseStock.type,
          location:        inward.location,
          locationType:    targetLocationType,
          colour:          warehouseStock.colour || "",
          mesh:            warehouseStock.mesh   || "",
          maxQuantity:     0,
          minQuantity:     0,
        },
      },
      { upsert: true, session, runValidators: true }
    );

    // ── Stock movement log ───────────────────────────────────────
    await StockMovement.create(
      [{
        partName:     searchName,
        fromLocation: warehouseStock.location,
        toLocation:   inward.location,
        quantity:     inward.quantity,
        movedBy:      req.user.id,
        reason:       "TRANSFER",
      }],
      { session }
    );

    // ── Complete the inward request ──────────────────────────────
    inward.status     = "ACCEPTED";
    inward.approvedBy = req.user.id;
    await inward.save({ session });

    await session.commitTransaction();
    session.endSession();

    await logActivity(req, {
      action:         "PRODUCTION_REQUEST_APPROVED",
      module:         "Warehouse",
      entityType:     "ProductionInward",
      entityId:       inward._id,
      description:    `Transferred ${inward.quantity} × ${searchName} to ${inward.location}`,
      sourceLocation: warehouseStock.location,
      destination:    inward.location,
    });

    res.json({
      success: true,
      message: `✓ ${inward.quantity} × ${searchName} transferred to ${inward.location}`,
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
