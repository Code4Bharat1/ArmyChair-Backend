//order controller
import csv from "csvtojson";
import mongoose from "mongoose";
import Order from "../models/order.model.js";
import { createVendor } from "./vendor.controller.js";
import { logActivity } from "../utils/logActivity.js";
import Inventory from "../models/inventory.model.js";
import XLSX from "xlsx";


const COLUMN_MAP = {
  dispatchedTo: [
    "dispatchedto",
    "vendor",
    "vendor name",
    "party",
    "customer",
    "supplier",
  ],
  chairModel: [
    "chairmodel",
    "product",
    "item",
    "item name",
    "model",
    "part",
  ],
  orderType: [
    "ordertype",
    "order type",
    "type",
  ],
  orderDate: [
    "orderdate",
    "order date",
    "date",
  ],
  deliveryDate: [
    "deliverydate",
    "delivery date",
    "due date",
    "expected date",
  ],
  quantity: [
    "quantity",
    "qty",
    "nos",
    "count",
    "units",
  ],
};

// ============================================================
// 🔥 FIX: Strip " (colour)" suffix from item names like
//    "2020 CHAIR BLACK (black)" → "2020 CHAIR BLACK"
//    so inventory lookup matches chairType correctly.
// ============================================================
function stripColourSuffix(name = "") {
  // Removes a trailing " (anything)" — case insensitive
  return name.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

// Extract just the colour from a name like "2020 CHAIR BLACK (black)" → "black"
function extractColour(name = "") {
  const match = name.match(/\(([^)]+)\)\s*$/);
  return match ? match[1].trim().toLowerCase() : null;
}

// 🔥 NORMALIZE ITEMS (BACKWARD COMPATIBLE)
function normalizeOrderItems(order) {
  if (order.items && order.items.length) return;
  if (order.chairModel && order.quantity) {
    order.items = [
      {
        name: order.chairModel,
        quantity: order.quantity,
        fittingStatus: "PENDING",
      },
    ];
  }
}

const createOrderInternal = async ({ row, user }) => {
  const {
    dispatchedTo,
    chairModel,
    items,
    orderType = "FULL",
    orderDate,
    remark,
    deliveryDate,
    quantity,
    salesPerson,
  } = row;

  if (
    !dispatchedTo ||
    !orderDate ||
    !deliveryDate ||
    ((!items || !items.length) && (!chairModel || !quantity))
  ) {
    throw new Error("Missing required fields");
  }

  let vendorId;
  if (mongoose.Types.ObjectId.isValid(dispatchedTo)) {
    vendorId = dispatchedTo;
  } else {
    const vendor = await createVendor(dispatchedTo);
    vendorId = vendor._id;
  }

  // ============================================================
  // 🔥 SMART ROUTING: FULL order → check FULL inventory
  // ============================================================
  let initialProgress;

  if (orderType === "SPARE") {
    // Spare orders always go to ORDER_PLACED (warehouse handles)
    initialProgress = "ORDER_PLACED";

  } else {
    // FULL order — normalize items array
    const orderItems =
      items && items.length > 0
        ? items
        : [{ name: chairModel, quantity: Number(quantity) }];

    let allInStock = true;

    for (const item of orderItems) {
      // ✅ FIX: Strip " (colour)" suffix before querying inventory
      // Frontend sends "2020 CHAIR BLACK (black)" but DB stores "2020 CHAIR BLACK"
      const baseChairType = stripColourSuffix(item.name);
      const colour = extractColour(item.name);

      // Build query: match chairType (stripped name) + optionally colour
      const inventoryQuery = {
        type: "FULL",
        chairType: { $regex: new RegExp(`^${baseChairType}$`, "i") },
        quantity: { $gt: 0 },
      };

      // If a colour was specified, filter by it too
      if (colour) {
        inventoryQuery.colour = { $regex: new RegExp(`^${colour}$`, "i") };
      }

      const inventoryRecords = await Inventory.find(inventoryQuery).sort({ quantity: -1 });

      const totalAvailable = inventoryRecords.reduce(
        (sum, r) => sum + r.quantity,
        0
      );

      console.log(
        `[Stock Check] "${item.name}" → base: "${baseChairType}", colour: "${colour}", ` +
        `available: ${totalAvailable}, needed: ${item.quantity}`
      );

      if (totalAvailable < item.quantity) {
        allInStock = false;
        break;
      }
    }

    if (allInStock) {
      // ✅ Stock available → send directly to warehouse, skip production
      // Inventory deduction happens at dispatch time (not here)
      initialProgress = "WAREHOUSE_COLLECTED";
      console.log(`[Smart Routing] Order routed to WAREHOUSE_COLLECTED (stock available)`);
    } else {
      // ❌ Stock insufficient → normal production flow
      initialProgress = "PRODUCTION_PENDING";
      console.log(`[Smart Routing] Order routed to PRODUCTION_PENDING (stock insufficient)`);
    }
  }

  // ============================================================
  // Create the order
  // ============================================================
  const creatorId = user.id || user._id;
  const assignedSalesPerson =
    user.role === "admin" ? salesPerson || creatorId : creatorId;

  const order = await Order.create({
    dispatchedTo: vendorId,
    chairModel,
    quantity: quantity ? Number(quantity) : undefined,
    items,
    orderType,
    orderDate,
    deliveryDate,
    remark,
    isPartial: false,
    createdBy: creatorId,
    salesPerson: assignedSalesPerson,
    progress: initialProgress,
    // ✅ Flag so frontend can show "Warehouse Direct" badge
    warehouseDirect: initialProgress === "WAREHOUSE_COLLECTED",
  });

  normalizeOrderItems(order);
  await order.save();

  return order;
};

/* ================= CREATE ORDER ================= */
export const createOrder = async (req, res) => {
  try {
    if (req.body.items && req.body.items.length) {
      req.body.chairModel = req.body.items[0].name;
      req.body.quantity = req.body.items[0].quantity;
    }
    const order = await createOrderInternal({
      row: req.body,
      user: req.user,
    });

    await logActivity(req, {
      action: "CREATE_ORDER",
      module: "Order",
      entityType: "Order",
      entityId: order._id,
      description: `Created order ${order.orderId} → routed to ${order.progress}`,
    });

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      order,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};


/* ================= GET ORDERS ================= */
export const getOrders = async (req, res) => {
  try {
    const { progress, from, to, staffId, range } = req.query;

    const query = {};

    if (req.user.role === "sales") {
      query.$or = [
        { createdBy: req.user.id },
        { salesPerson: req.user.id },
      ];
    }

    if (progress) query.progress = progress;

    if (staffId) {
      query.$or = [
        { createdBy: staffId },
        { salesPerson: staffId },
      ];
    }

    if (range) {
      const now = new Date();
      let start, end;

      if (range === "today") {
        start = new Date(now.setHours(0, 0, 0, 0));
        end = new Date(now.setHours(23, 59, 59, 999));
      }
      if (range === "yesterday") {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        start = new Date(y.setHours(0, 0, 0, 0));
        end = new Date(y.setHours(23, 59, 59, 999));
      }
      if (range === "last7days") {
        start = new Date();
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        end = new Date();
      }
      if (range === "thisMonth") {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date();
      }
      if (range === "lastMonth") {
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
      }

      if (start && end) {
        query.orderDate = { $gte: start, $lte: end };
      }
    }

    if (from && to) {
      query.orderDate = {
        $gte: new Date(from),
        $lte: new Date(to),
      };
    }

    const orders = await Order.find(query)
      .populate("createdBy", "name")
      .populate("salesPerson", "name")
      .populate("dispatchedTo", "name")
      .sort({ createdAt: -1 });

    orders.forEach(normalizeOrderItems);
    res.json({ orders });
  } catch (err) {
    console.error("GET ORDERS ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

/* ================= GET SINGLE ORDER ================= */
export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("dispatchedTo", "name")
      .populate("createdBy", "name email")
      .populate("salesPerson", "name email");

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    res.status(200).json({ success: true, order });
  } catch (error) {
    res.status(400).json({ success: false, message: "Invalid Order ID" });
  }
};

/* ================= UPDATE ORDER (SALES EDIT) ================= */
export const updateOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (Array.isArray(req.body.items) && req.body.items.length > 0) {
      order.items = req.body.items.map((i) => ({
        name: String(i.name).trim(),
        quantity: Number(i.quantity),
      }));
      order.chairModel = order.items[0].name;
      order.quantity = order.items[0].quantity;
    }

    if (req.body.remark !== undefined) order.remark = req.body.remark;
    if (req.body.orderDate) order.orderDate = req.body.orderDate;
    if (req.body.deliveryDate) order.deliveryDate = req.body.deliveryDate;

    if (req.body.dispatchedTo) {
      if (mongoose.Types.ObjectId.isValid(req.body.dispatchedTo)) {
        order.dispatchedTo = req.body.dispatchedTo;
      } else {
        const vendor = await createVendor(req.body.dispatchedTo);
        order.dispatchedTo = vendor._id;
      }
    }

    await order.save();

    await logActivity(req, {
      action: "ORDER_UPDATE",
      module: "Order",
      entityType: "Order",
      entityId: order._id,
      description: `Order ${order.orderId} updated (${order.items.length} items)`,
    });

    res.status(200).json({ success: true, message: "Order updated successfully", order });
  } catch (error) {
    console.error("UPDATE ORDER ERROR:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

/* ================= UPDATE ORDER PROGRESS ================= */
export const updateOrderProgress = async (req, res) => {
  try {
    const { progress } = req.body;
    const role = req.user.role;

    const allowed = [
      "ORDER_PLACED",
      "PRODUCTION_PENDING",
      "PRODUCTION_IN_PROGRESS",
      "PRODUCTION_COMPLETED",
      "WAREHOUSE_COLLECTED",
      "FITTING_IN_PROGRESS",
      "FITTING_COMPLETED",
      "READY_FOR_DISPATCH",
      "DISPATCHED",
      "PARTIAL",
      "PARTIALLY_DISPATCHED",
    ];

    if (!allowed.includes(progress)) {
      return res.status(400).json({ message: "Invalid progress" });
    }

    if (role === "sales" && progress !== "DISPATCHED") {
      return res.status(403).json({ message: "Sales can only dispatch orders" });
    }

    if (role === "production") {
      const allowedProduction = [
        "PRODUCTION_PENDING",
        "PRODUCTION_IN_PROGRESS",
        "PRODUCTION_COMPLETED",
      ];
      if (!allowedProduction.includes(progress)) {
        return res.status(403).json({ message: "Invalid production action" });
      }
    }

    if (role === "warehouse") {
      const allowedWarehouse = [
        "WAREHOUSE_COLLECTED",
        "FITTING_IN_PROGRESS",
        "FITTING_COMPLETED",
        "READY_FOR_DISPATCH",
        "DISPATCHED",
        "PARTIAL",
      ];
      if (!allowedWarehouse.includes(progress)) {
        return res.status(403).json({ message: "Invalid warehouse action" });
      }
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (progress === "PRODUCTION_COMPLETED") {
      if (!order.productionWorker) {
        return res.status(400).json({ message: "Assign production worker before completing" });
      }
      order.productionCompletedAt = new Date();
    }

    order.progress = progress;
    order.isPartial = progress === "PARTIAL";
    await order.save();

    res.status(200).json({ success: true, order });
  } catch (error) {
    res.status(500).json({ message: "Status update failed" });
  }
};

/* ================= DELETE ORDER ================= */
export const deleteOrder = async (req, res) => {
  try {
    const deletedOrder = await Order.findByIdAndDelete(req.params.id);

    if (!deletedOrder) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    await logActivity(req, {
      action: "ORDER_DELETE",
      module: "Order",
      entityType: "Order",
      entityId: deletedOrder._id,
      description: `Deleted order ${deletedOrder.orderId}`,
    });

    res.status(200).json({ success: true, message: "Order deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete order" });
  }
};

/* ================= GET ORDER BY ORDER ID ================= */
/* ================= GET ORDER BY ORDER ID ================= */
// FIXED: now returns `items` array so the Return modal can show all SKUs
export const getOrderByOrderId = async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId })
      .populate("dispatchedTo", "name")
      .populate("salesPerson", "name")
      .populate("createdBy", "name");

    if (!order) return res.status(404).json({ message: "Order not found" });

    // Normalize: ensure items array is always populated
    // (legacy orders may only have chairModel + quantity)
    const items =
      order.items?.length
        ? order.items
        : order.chairModel
        ? [{ name: order.chairModel, quantity: order.quantity, fittingStatus: "PENDING" }]
        : [];

    res.status(200).json({
      success: true,
      order: {
        orderId:      order.orderId,
        chairModel:   order.chairModel,
        quantity:     order.quantity,
        items,                          // ← THIS was missing
        dispatchedTo: order.dispatchedTo,
        salesPerson:  order.salesPerson,
        progress:     order.progress,   // ← also send progress so modal can show warning
      },
    });
  } catch (error) {
    console.error("Fetch Order By Order ID Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
export const checkStockAvailability = async (req, res) => {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "items array required" });
    }

    const breakdown = [];
    let allAvailable = true;

    for (const item of items) {
      // ✅ Strip "(colour)" suffix before querying
      const baseChairType = stripColourSuffix(item.name);
      const colour = extractColour(item.name);

      const inventoryQuery = {
        type: "FULL",
        chairType: { $regex: new RegExp(`^${baseChairType}$`, "i") },
        quantity: { $gt: 0 },
      };

      if (colour) {
        inventoryQuery.colour = { $regex: new RegExp(`^${colour}$`, "i") };
      }

      const records = await Inventory.find(inventoryQuery);
      const available = records.reduce((s, r) => s + r.quantity, 0);
      const sufficient = available >= item.quantity;

      if (!sufficient) allAvailable = false;

      breakdown.push({
        name: item.name,
        requested: item.quantity,
        available,
        sufficient,
      });
    }

    res.json({ allAvailable, breakdown });
  } catch (err) {
    console.error("CHECK STOCK ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

export const staffPerformanceAnalytics = async (req, res) => {
  try {
    const { from, to } = req.query;
    const match = {};

    if (from && to) {
      match.orderDate = { $gte: new Date(from), $lte: new Date(to) };
    }

    const data = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $ifNull: ["$salesPerson", "$createdBy"] },
          orders: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          _id: "$user._id",
          name: "$user.name",
          role: "$user.role",
          orders: 1,
        },
      },
      { $sort: { orders: -1 } },
    ]);

    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const productAnalytics = async (req, res) => {
  try {
    const { from, to } = req.query;
    const match = {};

    if (from && to) {
      match.orderDate = { $gte: new Date(from), $lte: new Date(to) };
    }

    const data = await Order.aggregate([
      { $match: match },
      { $group: { _id: "$chairModel", orders: { $sum: 1 } } },
      { $project: { name: "$_id", orders: 1, _id: 0 } },
      { $sort: { orders: -1 } },
    ]);

    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const normalizeHeader = (str = "") =>
  str.toLowerCase().replace(/[^a-z0-9]/g, "");

const normalizeRow = (row) => {
  const normalized = {};
  const normalizedKeys = Object.keys(row).map((key) => ({
    original: key,
    clean: normalizeHeader(key),
    value: row[key],
  }));

  for (const targetField in COLUMN_MAP) {
    for (const alias of COLUMN_MAP[targetField]) {
      const cleanAlias = normalizeHeader(alias);
      const match = normalizedKeys.find((k) => k.clean.includes(cleanAlias));
      if (match) {
        normalized[targetField] = match.value;
        break;
      }
    }
  }

  return normalized;
};

const normalizeDate = (value) => {
  if (!value) return null;
  if (typeof value === "number") {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(excelEpoch.getTime() + value * 86400000);
  }
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
};

export const uploadOrders = async (req, res) => {
  try {
    if (!req.files || !req.files.length) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    let total = 0;
    let created = 0;
    const errors = [];

    for (const file of req.files) {
      let rows = [];
      const ext = file.originalname.split(".").pop().toLowerCase();

      if (ext === "csv") {
        const csvString = file.buffer.toString("utf-8");
        rows = await csv().fromString(csvString);
      } else if (ext === "xlsx" || ext === "xls") {
        const workbook = XLSX.read(file.buffer, { type: "buffer" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(sheet);
      } else {
        continue;
      }

      for (const rawRow of rows) {
        if (!Object.keys(rawRow).length) continue;
        total++;

        try {
          const row = normalizeRow(rawRow);
          row.quantity = Number(String(row.quantity).replace(/[^0-9.]/g, ""));
          row.orderType =
            String(row.orderType || "").trim().toUpperCase() === "SPARE"
              ? "SPARE"
              : "FULL";
          row.orderDate = normalizeDate(row.orderDate);
          row.deliveryDate = normalizeDate(row.deliveryDate);
          if (row.dispatchedTo) row.dispatchedTo = String(row.dispatchedTo).trim();
          if (row.chairModel) row.chairModel = String(row.chairModel).trim();

          const order = await createOrderInternal({ row, user: req.user });

          await logActivity(req, {
            action: "CREATE_ORDER_BULK",
            module: "Order",
            entityType: "Order",
            entityId: order._id,
            description: `Bulk order created (${order.orderId})`,
          });

          created++;
        } catch (err) {
          errors.push({ row: total, message: err.message });
        }
      }
    }

    res.status(200).json({ success: true, total, created, failed: errors.length, errors });
  } catch (err) {
    res.status(500).json({ message: "Bulk upload failed" });
  }
};

export const assignProductionWorker = async (req, res) => {
  try {
    const { workerName } = req.body;
    if (!workerName) return res.status(400).json({ message: "Worker name is required" });

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.progress !== "PRODUCTION_PENDING") {
      return res.status(400).json({ message: "Order is not in production stage" });
    }
    if (order.productionWorker) {
      return res.status(400).json({ message: "Worker already assigned" });
    }

    order.productionWorker = workerName;
    order.productionAssignedAt = new Date();
    await order.save();

    res.status(200).json({ success: true, message: "Worker assigned successfully", order });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const assignProductionWorkersPerItem = async (req, res) => {
  try {
    const { assignments } = req.body;

    if (!Array.isArray(assignments) || assignments.length === 0) {
      return res.status(400).json({ message: "Product-wise assignments required" });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.progress !== "PRODUCTION_PENDING") {
      return res.status(400).json({ message: "Order not in production pending stage" });
    }

    for (const a of assignments) {
      if (!a.product || !a.worker || !a.quantity) {
        return res.status(400).json({ message: "Product, quantity and worker are required" });
      }
      const item = order.items.find(
        (i) => i.name.trim().toLowerCase() === String(a.product).trim().toLowerCase()
      );
      if (!item) return res.status(400).json({ message: `Invalid product: ${a.product}` });
      if (Number(a.quantity) !== Number(item.quantity)) {
        return res.status(400).json({
          message: `Quantity mismatch for ${a.product}. Required ${item.quantity}`,
        });
      }
    }

    order.productionAssignments = assignments.map((a) => ({
      product: a.product,
      quantity: Number(a.quantity),
      worker: a.worker,
      assignedAt: new Date(),
    }));
    order.productionWorker = assignments[0].worker;
    order.productionAssignedAt = new Date();

    await order.save();

    await logActivity(req, {
      action: "PRODUCTION_ASSIGN_PRODUCT_WORKER",
      module: "Order",
      entityType: "Order",
      entityId: order._id,
      description: `Assigned workers per product for order ${order.orderId}`,
    });

    res.status(200).json({ success: true, message: "Workers assigned per product successfully", order });
  } catch (err) {
    console.error("ASSIGN PRODUCT WORKER ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

export const acceptProductionOrder = async (req, res) => {
  try {
    const { parts } = req.body;

    if (!parts || typeof parts !== "object" || Object.keys(parts).length === 0) {
      return res.status(400).json({ message: "No parts selected" });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (!["PRODUCTION_PENDING", "PRODUCTION_IN_PROGRESS"].includes(order.progress)) {
      return res.status(400).json({ message: "Order not in production stage" });
    }

    // ✅ Only fetch PRODUCTION locationType inventory
    const inventory = await Inventory.find({
      type: "SPARE",
      locationType: "PRODUCTION",
    });

    console.log("[acceptProductionOrder] Production inventory records:", inventory.length);
    console.log("[acceptProductionOrder] Parts to deduct:", parts);

    // ✅ Validate ALL parts have enough stock BEFORE deducting anything
    for (const [partName, qtyToUse] of Object.entries(parts)) {
      const qty = Number(qtyToUse || 0);
      if (qty <= 0) continue;

      const matchingItems = inventory.filter(
        (i) => i.partName?.trim().toLowerCase() === partName.trim().toLowerCase()
      );

      const totalAvailable = matchingItems.reduce((sum, i) => sum + i.quantity, 0);
      console.log(`[Validate] "${partName}": need ${qty}, have ${totalAvailable}`);

      if (totalAvailable < qty) {
        return res.status(400).json({
          message: `Not enough "${partName}" in production inventory. Available: ${totalAvailable}, Required: ${qty}`,
        });
      }
    }

    // ✅ All validated — now deduct
    for (const [partName, qtyToUse] of Object.entries(parts)) {
      const qty = Number(qtyToUse || 0);
      if (qty <= 0) continue;

      const matchingItems = inventory
        .filter((i) => i.partName?.trim().toLowerCase() === partName.trim().toLowerCase())
        .sort((a, b) => b.quantity - a.quantity); // deduct from largest first

      let remaining = qty;
      for (const item of matchingItems) {
        if (remaining <= 0) break;
        const deduct = Math.min(item.quantity, remaining);
        remaining -= deduct;

        const result = await Inventory.updateOne(
          { _id: item._id, quantity: { $gte: deduct } },
          { $inc: { quantity: -deduct } }
        );
        console.log(`[Deduct] ${partName} — deducted ${deduct} from ${item._id}, modified: ${result.modifiedCount}`);
      }
    }

    // ✅ Merge parts into order record
    const mergedParts = { ...(order.productionParts || {}) };
    for (const [partName, qty] of Object.entries(parts)) {
      const key = partName.trim().toLowerCase();
      mergedParts[key] = (mergedParts[key] || 0) + Number(qty);
    }

    order.productionParts = mergedParts;
    order.progress = "PRODUCTION_IN_PROGRESS";
    await order.save();

    res.status(200).json({
      success: true,
      message: "Production materials issued and inventory deducted successfully",
      order,
    });
  } catch (err) {
    console.error("ACCEPT PRODUCTION ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

export const preDispatchEdit = async (req, res) => {
  try {
    const { dispatchedTo, orderDate, deliveryDate, remark } = req.body;
    const order = await Order.findById(req.params.id).populate("dispatchedTo", "name");

    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.progress !== "READY_FOR_DISPATCH") {
      return res.status(400).json({ message: "Only orders ready for dispatch can be amended" });
    }

    const oldValues = {
      dispatchedTo: order.dispatchedTo?.name,
      orderDate: order.orderDate,
      deliveryDate: order.deliveryDate,
      remark: order.remark,
    };

    if (remark !== undefined) order.remark = remark;
    if (dispatchedTo) {
      if (mongoose.Types.ObjectId.isValid(dispatchedTo)) {
        order.dispatchedTo = dispatchedTo;
      } else {
        const vendor = await createVendor(dispatchedTo);
        order.dispatchedTo = vendor._id;
      }
    }
    if (orderDate) order.orderDate = orderDate;
    if (deliveryDate) order.deliveryDate = deliveryDate;
    order.lastAmendedAt = new Date();
    order.amendedBy = req.user.id;

    await order.save();

    await logActivity(req, {
      action: "ORDER_AMENDED_PRE_DISPATCH",
      module: "Order",
      entityType: "Order",
      entityId: order._id,
      description: `Order ${order.orderId} amended before dispatch`,
      meta: { before: oldValues, after: { dispatchedTo, orderDate, deliveryDate, remark } },
    });

    res.json({ success: true, message: "Order updated before dispatch", order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Pre-dispatch edit failed" });
  }
};

export const partialDispatch = async (req, res) => {
  try {
    const { itemQuantities, notes } = req.body;

    if (!itemQuantities || typeof itemQuantities !== "object" || !Object.keys(itemQuantities).length) {
      return res.status(400).json({ message: "itemQuantities required" });
    }

    const totalNow = Object.values(itemQuantities).reduce((s, q) => s + Number(q || 0), 0);
    if (totalNow <= 0) return res.status(400).json({ message: "Enter valid quantities" });

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const dispatchableStatuses = [
  "READY_FOR_DISPATCH",
  "PARTIALLY_DISPATCHED",
  "FITTING_IN_PROGRESS",   // ← allow partial SKU dispatch mid-fitting
  "FITTING_COMPLETED", 
   "WAREHOUSE_COLLECTED",    // ← allow dispatch after all fitting done
];

if (!dispatchableStatuses.includes(order.progress)) {
  return res.status(400).json({ message: "Order is not ready for dispatch" });
}

    const orderItems = order.items?.length
      ? order.items
      : [{ name: order.chairModel, quantity: order.quantity }];

    const totalOrderQty = orderItems.reduce((s, i) => s + i.quantity, 0);
    const alreadyDispatched = order.dispatchedQuantity || 0;

    for (const [itemName, qty] of Object.entries(itemQuantities)) {
      const qtyNum = Number(qty);
      if (qtyNum <= 0) continue;

      const orderItem = orderItems.find(
        (i) => i.name.toLowerCase().trim() === itemName.toLowerCase().trim()
      );
      if (!orderItem) return res.status(400).json({ message: `Item not found: ${itemName}` });

      let alreadyForItem = 0;
      order.dispatches?.forEach((d) => {
        alreadyForItem += Number(d.itemQuantities?.[itemName] || 0);
      });

      const remainingForItem = orderItem.quantity - alreadyForItem;
      if (qtyNum > remainingForItem) {
        return res.status(400).json({
          message: `${itemName}: Cannot dispatch ${qtyNum}, only ${remainingForItem} remaining`,
        });
      }
    }

    // FULL order: deduct inventory per item (strip colour suffix for lookup)
    const shouldDeductInventory =
  order.orderType === "FULL" && order.warehouseDirect === true;

if (shouldDeductInventory) {
  for (const [itemName, qty] of Object.entries(itemQuantities)) {
    const qtyNum = Number(qty);
    if (qtyNum <= 0) continue;

    const baseChairType = stripColourSuffix(itemName);
    const colour = extractColour(itemName);

    const inventoryQuery = {
      type: "FULL",
      chairType: { $regex: new RegExp(`^${baseChairType}$`, "i") },
      quantity: { $gt: 0 },
    };

    if (colour) {
      inventoryQuery.colour = { $regex: new RegExp(`^${colour}$`, "i") };
    }

    const records = await Inventory.find(inventoryQuery).sort({ quantity: -1 });
    const available = records.reduce((s, r) => s + r.quantity, 0);

    if (available < qtyNum) {
      return res.status(400).json({
        message: `Insufficient stock for ${itemName}. Available: ${available}, Required: ${qtyNum}`,
      });
    }

    let remaining = qtyNum;
    for (const record of records) {
      if (remaining <= 0) break;
      const deduct = Math.min(record.quantity, remaining);
      remaining -= deduct;
      await Inventory.updateOne(
        { _id: record._id },
        { $inc: { quantity: -deduct } }
      );
    }
  }
}
    order.dispatches.push({
      quantity: totalNow,
      itemQuantities,
      notes: notes || "",
      dispatchedBy: req.user.id,
      date: new Date(),
    });

    order.dispatchedQuantity = alreadyDispatched + totalNow;
    order.progress = order.dispatchedQuantity >= totalOrderQty ? "DISPATCHED" : "PARTIALLY_DISPATCHED";

    await order.save();

    await logActivity(req, {
      action: "ORDER_PARTIAL_DISPATCH",
      module: "Order",
      entityType: "Order",
      entityId: order._id,
      description: `Dispatched ${totalNow} units for order ${order.orderId}`,
    });

    res.json({
      success: true,
      message: `Dispatched ${totalNow} units. ${order.progress === "DISPATCHED" ? "Order fully complete." : `${totalOrderQty - order.dispatchedQuantity} remaining.`}`,
      order,
    });
  } catch (err) {
    console.error("PARTIAL DISPATCH ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

export const updateItemFitting = async (req, res) => {
  try {
    const { itemIndex, fittingStatus } = req.body;

    if (!["PENDING", "IN_PROGRESS", "COMPLETED"].includes(fittingStatus)) {
      return res.status(400).json({ message: "Invalid fitting status" });
    }

    const updatePath = `items.${itemIndex}.fittingStatus`;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { $set: { [updatePath]: fittingStatus } },
      { new: true }
    );

    if (!order) return res.status(404).json({ message: "Order not found" });

    const anyCompleted = order.items.some(
  (i) => i.fittingStatus === "COMPLETED"
);

const allCompleted = order.items.every(
  (i) => i.fittingStatus === "COMPLETED"
);



let newProgress = order.progress;

if (allCompleted) {
  newProgress = "FITTING_COMPLETED";
} else {
  // stay in fitting no matter what
  newProgress = "FITTING_IN_PROGRESS";
}

    if (newProgress !== order.progress) {
      await Order.findByIdAndUpdate(req.params.id, { $set: { progress: newProgress } });
    }

    const updatedOrder = await Order.findById(req.params.id);
    res.json({ success: true, order: updatedOrder });
  } catch (err) {
    console.error("UPDATE ITEM FITTING ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};