//order controller
import csv from "csvtojson";
import mongoose from "mongoose";
import Order from "../models/order.model.js";
import { createVendor } from "./vendor.controller.js";
import { logActivity } from "../utils/logActivity.js";
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
// 🔥 NORMALIZE ITEMS (BACKWARD COMPATIBLE)
function normalizeOrderItems(order) {
  // If new multi-item order already exists
  if (order.items && order.items.length) return;

  // Old single-item order → convert logically
  if (order.chairModel && order.quantity) {
    order.items = [
      {
        name: order.chairModel,
        quantity: order.quantity,
      },
    ];
  }
}

const createOrderInternal = async ({ row, user }) => {
  const {
  dispatchedTo,
  chairModel,
  items,              // ✅ ADD
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
  (
    (!items || !items.length) &&
    (!chairModel || !quantity)
  )
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
  let initialProgress;

  if (orderType === "FULL") {
    initialProgress = "PRODUCTION_PENDING";
  } else {
    initialProgress = "ORDER_PLACED";
  }

  const creatorId = user.id || user._id;
  const assignedSalesPerson =
    user.role === "admin" ? salesPerson || creatorId : creatorId;

 const order = await Order.create({
  dispatchedTo: vendorId,
  chairModel,
  quantity: quantity ? Number(quantity) : undefined,
  items, // ✅ NEW
  orderType,
  orderDate,
  deliveryDate,
  remark,
  isPartial: false,
  createdBy: creatorId,
  salesPerson: assignedSalesPerson,
  progress: initialProgress,
});

// 🔥 CRITICAL
normalizeOrderItems(order);
await order.save();

return order;

};

/* ================= CREATE ORDER ================= */
export const createOrder = async (req, res) => {
  try {

     // ✅ ADD HERE
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
      description: `Created order ${order.orderId}`,
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

    // 🔐 ADD THIS BLOCK (does not break existing logic)
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

    /* RANGE SUPPORT */
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
        query.orderDate = {
          $gte: start,
          $lte: end,
        };
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
  .populate("salesPerson", "name")   // 👈 ADD THIS
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
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Invalid Order ID",
    });
  }
};

/* ================= UPDATE ORDER (SALES EDIT) ================= */
export const updateOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // ❌ Optional restriction (enable later)
    // if (order.progress !== "ORDER_PLACED") { ... }

    // ===============================
    // 🔥 HANDLE ITEMS FIRST
    // ===============================
    if (Array.isArray(req.body.items) && req.body.items.length > 0) {
      order.items = req.body.items.map((i) => ({
        name: String(i.name).trim(),
        quantity: Number(i.quantity),
      }));

      // 🔒 BACKWARD COMPAT
      order.chairModel = order.items[0].name;
      order.quantity = order.items[0].quantity;
    }

    // ===============================
    // 🔁 OTHER FIELDS
    // ===============================
    if (req.body.remark !== undefined) {
      order.remark = req.body.remark;
    }

    if (req.body.orderDate) {
      order.orderDate = req.body.orderDate;
    }

    if (req.body.deliveryDate) {
      order.deliveryDate = req.body.deliveryDate;
    }

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

    res.status(200).json({
      success: true,
      message: "Order updated successfully",
      order,
    });

  } catch (error) {
    console.error("UPDATE ORDER ERROR:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
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
    ];

    if (!allowed.includes(progress)) {
      return res.status(400).json({ message: "Invalid progress" });
    }

    // SALES RULES
    if (role === "sales" && progress !== "DISPATCHED") {
      return res.status(403).json({
        message: "Sales can only dispatch orders",
      });
    }

    // PRODUCTION RULES
    if (role === "production") {
      const allowedProduction = [
  "PRODUCTION_PENDING",
  "PRODUCTION_IN_PROGRESS",
  "PRODUCTION_COMPLETED",
];


      if (!allowedProduction.includes(progress)) {
        return res.status(403).json({
          message: "Invalid production action",
        });
      }
    }

    // WAREHOUSE RULES
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
        return res.status(403).json({
          message: "Invalid warehouse action",
        });
      }
    }

    // 🔥 FETCH ORDER FIRST
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // 🚨 Production completion validation
    if (progress === "PRODUCTION_COMPLETED") {
      if (!order.productionWorker) {
        return res.status(400).json({
          message: "Assign production worker before completing",
        });
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
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }
    await logActivity(req, {
      action: "ORDER_DELETE",
      module: "Order",
      entityType: "Order",
      entityId: deletedOrder._id,
      description: `Deleted order ${deletedOrder.orderId}`,
    });

    res.status(200).json({
      success: true,
      message: "Order deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete order",
    });
  }
};

/* ================= GET ORDER BY ORDER ID ================= */
export const getOrderByOrderId = async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId })
      .populate("dispatchedTo", "name")
      .populate("salesPerson", "name")
      .populate("createdBy", "name");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.status(200).json({
      success: true,
      order: {
        orderId: order.orderId,
        chairModel: order.chairModel,
        quantity: order.quantity,
        dispatchedTo: order.dispatchedTo,
        salesPerson: order.salesPerson,
      },
    });
  } catch (error) {
    console.error("Fetch Order By Order ID Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
export const staffPerformanceAnalytics = async (req, res) => {
  try {
    const { from, to } = req.query;
    const match = {};

    if (from && to) {
      match.orderDate = {
        $gte: new Date(from),
        $lte: new Date(to),
      };
    }

    const data = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $ifNull: ["$salesPerson", "$createdBy"] },
          orders: { $sum: 1 }, // ← count orders, not chairs
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
          _id: "$user._id",   // ✅ ADD THIS
          name: "$user.name",
          role: "$user.role",
          orders: 1,
        }

      },
      { $sort: { orders: -1 } },
    ]);

    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
// GET /orders/analytics/products
export const productAnalytics = async (req, res) => {
  try {
    const { from, to } = req.query;
    const match = {};

    if (from && to) {
      match.orderDate = {
        $gte: new Date(from),
        $lte: new Date(to),
      };
    }

    const data = await Order.aggregate([
      { $match: match },
      { $group: { _id: "$chairModel", orders: { $sum: 1 } } }, // count orders
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

  // Convert Excel headers to normalized form
  const normalizedKeys = Object.keys(row).map((key) => ({
    original: key,
    clean: normalizeHeader(key),
    value: row[key],
  }));

  for (const targetField in COLUMN_MAP) {
    for (const alias of COLUMN_MAP[targetField]) {
      const cleanAlias = normalizeHeader(alias);

      const match = normalizedKeys.find((k) =>
        k.clean.includes(cleanAlias)
      );

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

  // Excel serial number (corrected)
  if (typeof value === "number") {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(excelEpoch.getTime() + value * 86400000);
  }

  // Already Date object
  if (value instanceof Date) {
    return value;
  }

  // String date
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

      // -------- CSV --------
      if (ext === "csv") {
        const csvString = file.buffer.toString("utf-8");
        rows = await csv().fromString(csvString);
      }

      // -------- EXCEL --------
      else if (ext === "xlsx" || ext === "xls") {
        const workbook = XLSX.read(file.buffer, { type: "buffer" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(sheet);
      }

      // -------- Unsupported --------
      else {
        continue;
      }

      for (const rawRow of rows) {
  if (!Object.keys(rawRow).length) continue;

  total++;

  try {
    const row = normalizeRow(rawRow);

    // ✅ REQUIRED FIXES
    row.quantity = Number(
      String(row.quantity).replace(/[^0-9.]/g, "")
    );

    row.orderType =
      String(row.orderType || "")
        .trim()
        .toUpperCase() === "SPARE"
        ? "SPARE"
        : "FULL";

    row.orderDate = normalizeDate(row.orderDate);
    row.deliveryDate = normalizeDate(row.deliveryDate);

    if (row.dispatchedTo) row.dispatchedTo = String(row.dispatchedTo).trim();
    if (row.chairModel) row.chairModel = String(row.chairModel).trim();

    const order = await createOrderInternal({
      row,
      user: req.user,
    });

    await logActivity(req, {
      action: "CREATE_ORDER_BULK",
      module: "Order",
      entityType: "Order",
      entityId: order._id,
      description: `Bulk order created (${order.orderId})`,
    });

    created++;
  } catch (err) {
    errors.push({
      row: total,
      message: err.message,
    });
  }
}

    }

    res.status(200).json({
      success: true,
      total,
      created,
      failed: errors.length,
      errors,
    });
  } catch (err) {
    res.status(500).json({
      message: "Bulk upload failed",
    });
  }
};


export const assignProductionWorker = async (req, res) => {
  try {
    const { workerName } = req.body;

    if (!workerName) {
      return res.status(400).json({
        message: "Worker name is required",
      });
    }

    // 🔥 FETCH ORDER FIRST
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    if (order.progress !== "PRODUCTION_PENDING") {
      return res.status(400).json({
        message: "Order is not in production stage",
      });
    }

    // ✅ Now safe to check this
    if (order.productionWorker) {
      return res.status(400).json({
        message: "Worker already assigned",
      });
    }

    order.productionWorker = workerName;
    order.productionAssignedAt = new Date();

    await order.save();

    res.status(200).json({
      success: true,
      message: "Worker assigned successfully",
      order,
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

import Inventory from "../models/inventory.model.js"; // make sure this exists

// export const acceptProductionOrder = async (req, res) => {
//   try {
//     const { parts } = req.body;

//     const order = await Order.findById(req.params.id);
//     if (!order) {
//       return res.status(404).json({ message: "Order not found" });
//     }

//     if (!order.productionWorker) {
//       return res.status(400).json({
//         message: "Assign worker before accepting",
//       });
//     }

//     if (
//       order.progress !== "PRODUCTION_PENDING" &&
//       order.progress !== "PRODUCTION_IN_PROGRESS"
//     ) {
//       return res.status(400).json({
//         message: "Order not in production stage",
//       });
//     }

//     if (!parts || Object.keys(parts).length === 0) {
//       return res.status(400).json({
//         message: "No parts selected",
//       });
//     }

//     const inventory = await Inventory.find({
//   type: "SPARE",
//   location: { $regex: "^PROD_" },
// });
// if (!inventory.length) {
//   return res.status(400).json({
//     message: "No production inventory available",
//   });
// }


//     // 🔥 VALIDATE + DEDUCT
//     for (const partName in parts) {
//       const qtyToUse = Number(parts[partName] || 0);
//       if (qtyToUse <= 0) continue;

//       const items = inventory.filter(i => {
//   if (!i.partName || typeof i.partName !== "string") return false;

//   return (
//     i.type === "SPARE" &&
//     i.partName.trim().toLowerCase() ===
//       String(partName).trim().toLowerCase()
//   );
// });


//       const totalAvailable = items.reduce(
//         (sum, i) => sum + i.quantity,
//         0
//       );

//       if (qtyToUse > totalAvailable) {
//         return res.status(400).json({
//           message: `Not enough ${partName}`,
//         });
//       }

//       // 🔥 Deduct from inventory documents
//       let remaining = qtyToUse;

//       for (const item of items) {
//         if (remaining <= 0) break;

//         const deduct = Math.min(item.quantity, remaining);
//         item.quantity -= deduct;
//         remaining -= deduct;

//         await item.save();
//       }
//     }

//     order.progress = "PRODUCTION_IN_PROGRESS";
//     await order.save();

//     res.status(200).json({
//       success: true,
//       message: "Production materials issued successfully",
//     });

//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: err.message });

//   }
// };


export const acceptProductionOrder = async (req, res) => {
  try {
    const { parts } = req.body;

    if (!parts || typeof parts !== "object" || Object.keys(parts).length === 0) {
      return res.status(400).json({
        message: "No parts selected",
      });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (!order.productionWorker) {
      return res.status(400).json({
        message: "Assign worker before accepting",
      });
    }

    if (
      order.progress !== "PRODUCTION_PENDING" &&
      order.progress !== "PRODUCTION_IN_PROGRESS"
    ) {
      return res.status(400).json({
        message: "Order not in production stage",
      });
    }

    // ===============================
    // 🔥 FIXED PRODUCTION VALIDATION
    // ===============================

    const existingParts = order.productionParts || {};

    // Merge existing + new parts first (WITHOUT saving yet)
    const mergedParts = { ...existingParts };

    for (const partName in parts) {
      const qtyToAdd = Number(parts[partName] || 0);
      if (qtyToAdd <= 0) continue;

      mergedParts[partName] =
        (mergedParts[partName] || 0) + qtyToAdd;
    }

    const quantities = Object.values(mergedParts);

    if (!quantities.length) {
      return res.status(400).json({
        message: "No valid parts provided",
      });
    }

    // 🔥 Chairs buildable = minimum part quantity
    const buildableQty = Math.min(...quantities);

    if (buildableQty > order.quantity) {
      return res.status(400).json({
        message: `Production exceeds order quantity. Order requires ${order.quantity}`,
      });
    }

    // ===============================
    // 🔥 INVENTORY VALIDATION
    // ===============================

    const inventory = await Inventory.find({
      type: "SPARE",
      location: { $regex: "^PROD_" },
    });

    if (!inventory.length) {
      return res.status(400).json({
        message: "No production inventory available",
      });
    }

    for (const partName in parts) {
      const qtyToUse = Number(parts[partName] || 0);
      if (qtyToUse <= 0) continue;

      const items = inventory.filter((i) => {
        if (!i.partName || typeof i.partName !== "string") return false;

        return (
          i.type === "SPARE" &&
          i.partName.trim().toLowerCase() ===
            String(partName).trim().toLowerCase()
        );
      });

      const totalAvailable = items.reduce(
        (sum, i) => sum + i.quantity,
        0
      );

      if (qtyToUse > totalAvailable) {
        return res.status(400).json({
          message: `Not enough ${partName} in production inventory`,
        });
      }

      let remaining = qtyToUse;

      for (const item of items) {
        if (remaining <= 0) break;

        const deduct = Math.min(item.quantity, remaining);
        remaining -= deduct;

        await Inventory.updateOne(
          { _id: item._id, quantity: { $gte: deduct } },
          { $inc: { quantity: -deduct } }
        );
      }
    }

    // ===============================
    // 🔥 SAVE MERGED PARTS
    // ===============================

    order.productionParts = mergedParts;

    order.progress = "PRODUCTION_IN_PROGRESS";

    await order.save();

    res.status(200).json({
      success: true,
      message: "Production materials issued successfully",
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

    const order = await Order.findById(req.params.id)
      .populate("dispatchedTo", "name");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.progress !== "READY_FOR_DISPATCH") {
      return res.status(400).json({
        message: "Only orders ready for dispatch can be amended",
      });
    }

    // ✅ CAPTURE OLD VALUES FIRST
    const oldValues = {
      dispatchedTo: order.dispatchedTo?.name,
      orderDate: order.orderDate,
      deliveryDate: order.deliveryDate,
      remark: order.remark,
    };

    // ✅ APPLY UPDATES
    if (remark !== undefined) {
      order.remark = remark;
    }

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

    // ✅ FIXED LOG
    await logActivity(req, {
      action: "ORDER_AMENDED_PRE_DISPATCH",
      module: "Order",
      entityType: "Order",
      entityId: order._id,
      description: `Order ${order.orderId} amended before dispatch`,
      meta: {
        before: oldValues,
        after: { dispatchedTo, orderDate, deliveryDate, remark },
      },
    });

    res.json({
      success: true,
      message: "Order updated before dispatch",
      order,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Pre-dispatch edit failed" });
  }
};



