//order controller
import csv from "csvtojson";
import mongoose from "mongoose";
import Order from "../models/order.model.js";
import { createVendor } from "./vendor.controller.js";
import { logActivity } from "../utils/logActivity.js";


const createOrderInternal = async ({ row, user }) => {
  const {
    dispatchedTo,
    chairModel,
    orderType = "FULL",
    orderDate,
    deliveryDate,
    quantity,
    salesPerson,
  } = row;

  if (!dispatchedTo || !chairModel || !orderDate || !deliveryDate || !quantity) {
    throw new Error("Missing required fields");
  }

  let vendorId;
  if (mongoose.Types.ObjectId.isValid(dispatchedTo)) {
    vendorId = dispatchedTo;
  } else {
    const vendor = await createVendor(dispatchedTo);
    vendorId = vendor._id;
  }

  const creatorId = user.id || user._id;
  const assignedSalesPerson =
    user.role === "admin" ? salesPerson || creatorId : creatorId;

  return await Order.create({
    dispatchedTo: vendorId,
    chairModel,
    orderType,
    orderDate,
    deliveryDate,
    quantity: Number(quantity),
    isPartial: false,
    createdBy: creatorId,
    salesPerson: assignedSalesPerson,
    progress: "ORDER_PLACED",
  });
};

/* ================= CREATE ORDER ================= */
export const createOrder = async (req, res) => {
  try {
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
      .populate("dispatchedTo", "name")
      .sort({ createdAt: -1 });

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

    if (order.progress !== "ORDER_PLACED") {
      return res.status(403).json({
        success: false,
        message: "Order cannot be edited after warehouse processing",
      });
    }

    const allowedUpdates = [
      "dispatchedTo",
      "chairModel",
      "orderDate",
      "deliveryDate",
      "quantity",
    ];

    const updates = {};

    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) {
        if (key === "quantity") {
          updates[key] = Number(req.body[key]);
        }
        else if (key === "dispatchedTo") {
          if (mongoose.Types.ObjectId.isValid(req.body[key])) {
            updates[key] = req.body[key];
          } else {
            const vendor = await createVendor(req.body[key]);
            updates[key] = vendor._id;
          }
        }
        else {
          updates[key] = req.body[key];
        }
      }
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    await logActivity(req, {
      action: "ORDER_UPDATE",
      module: "Order",
      entityType: "Order",
      entityId: updatedOrder._id,
      description: `Order ${updatedOrder.orderId} updated for ${updatedOrder.chairModel} qty ${updatedOrder.quantity}`,
    });

    res.status(200).json({
      success: true,
      message: "Order updated successfully",
      order: updatedOrder,
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

    // 🔐 SALES RULES
    if (role === "sales" && progress !== "DISPATCHED") {
      return res.status(403).json({
        message: "Sales can only dispatch orders",
      });
    }

    // 🔐 WAREHOUSE RULES
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

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      {
        progress,
        isPartial: progress === "PARTIAL",
      },
      { new: true },
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

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

export const uploadOrders = async (req, res) => {
  try {
    if (!req.files || !req.files.length) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    let total = 0;
    let created = 0;
    const errors = [];

    for (const file of req.files) {
      const csvString = file.buffer.toString("utf-8");
      const rows = await csv().fromString(csvString);

      for (const row of rows) {
        total++;
        try {
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
