import Order from "../models/order.model.js";
import { createVendor } from "./vendor.controller.js";
import { logActivity } from "../utils/logActivity.js";

/* ================= CREATE ORDER ================= */
export const createOrder = async (req, res) => {
  try {
    const {
      dispatchedTo,
      chairModel,
      orderDate,
      deliveryDate,
      quantity,
      salesPerson,
      orderType = "FULL",
    } = req.body;

    if (
      !dispatchedTo ||
      !chairModel ||
      !orderDate ||
      !deliveryDate ||
      !quantity
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const creatorId = req.user.id || req.user._id;
    let assignedSalesPerson;

    if (req.user.role === "admin") {
      if (!salesPerson) {
        return res.status(400).json({
          success: false,
          message: "Admin must assign a sales person",
        });
      }
      assignedSalesPerson = salesPerson;
    } else {
      assignedSalesPerson = creatorId;
    }

    const vendor = await createVendor(dispatchedTo);

    const order = await Order.create({
      dispatchedTo: vendor._id,
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
    await logActivity(req, {
      action: "CREATE_ORDER",
      module: "Order",
      entityType: "Order",
      entityId: order._id,
      description: `Created order ${order.orderId} for ${chairModel} qty ${quantity}`,
      assignedBy: req.user.name,
    });

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      order,
    });
  } catch (error) {
    console.error("CREATE ORDER ERROR:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/* ================= GET ORDERS ================= */
export const getOrders = async (req, res) => {
  try {
    const filter = {};
    const role = req.user.role;
    const userId = req.user.id || req.user._id;

    if (role === "sales") {
      filter.salesPerson = userId;
    }

    // ❗ warehouse CAN see partial orders (no filter applied)

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .populate({
  path: "dispatchedTo",
  select: "name",
  options: { strictPopulate: false }
})

      .populate("createdBy", "name email")
      .populate("salesPerson", "name email");

    res.status(200).json({ success: true, orders });
  } catch (error) {
    console.error("GET ORDERS ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
    });
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

    // 🔒 lock after warehouse processing
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
        updates[key] =
          key === "quantity" ? Number(req.body[key]) : req.body[key];
      }
    }

    const updatedOrder = await Order.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    await logActivity(req, {
      action: "ORDER_STATUS_UPDATE",
      module: "Order",
      entityType: "Order",
      entityId: order._id,
      description: `Order ${order.orderId} moved to ${progress}`,
    });

    res.status(200).json({
      success: true,
      message: "Order updated successfully",
      order: updatedOrder,
    });
  } catch (error) {
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
        $project: { name: "$user.name", role: "$user.role", orders: 1, _id: 0 },
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
