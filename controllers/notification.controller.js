import Inventory from "../models/inventory.model.js";
import Order from "../models/order.model.js";
import User from "../models/User.model.js";

/* ================= GET NOTIFICATIONS ================= */
export const getNotifications = async (req, res) => {
  try {
    const notifications = [];

    /* ================= FULL INVENTORY (CHAIRS) ================= */
    const fullStockAlerts = await Inventory.find({
      type: "FULL",
      $expr: { $lt: ["$quantity", "$minQuantity"] },
    });

    fullStockAlerts.forEach((item) => {
      const level = item.quantity === 0 ? "Critical" : "Low";

      notifications.push({
        _id: `full-${item._id}`,
        title: `${level} Stock Alert`,
        message: `${item.chairType} (${item.color}) has ${item.quantity} units left`,
        redirectUrl: "/superadmin/inventory",
      });
    });

    /* ================= SPARE INVENTORY ================= */
    const spareStockAlerts = await Inventory.find({
      type: "SPARE",
      quantity: { $lt: 5 },
    });

    spareStockAlerts.forEach((item) => {
      const level = item.quantity === 0 ? "Critical" : "Low";

      notifications.push({
        _id: `spare-${item._id}`,
        title: `${level} Spare Stock Alert`,
        message: `${item.partName} has ${item.quantity} units left`,
        redirectUrl: "/superadmin/spareparts",
      });
    });

    /* ================= DELAYED ORDERS ================= */
    const delayedOrders = await Order.find({
      deliveryDate: { $lt: new Date() },
      status: { $ne: "DELIVERED" },
    });

    delayedOrders.forEach((order) => {
      notifications.push({
        _id: `order-${order._id}`,
        title: "Order Delayed",
        message: `Order #${order.orderId} is delayed`,
        redirectUrl: "/superadmin/order",
      });
    });

    res.status(200).json(notifications);
  } catch (error) {
    console.error("NOTIFICATION ERROR:", error);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
};

/* ================= UNREAD COUNT ================= */
export const getUnreadCount = async (req, res) => {
  try {
    const fullCount = await Inventory.countDocuments({
      type: "FULL",
      $expr: { $lt: ["$quantity", "$minQuantity"] },
    });

    const spareCount = await Inventory.countDocuments({
      type: "SPARE",
      quantity: { $lt: 5 },
    });

    const orderCount = await Order.countDocuments({
      deliveryDate: { $lt: new Date() },
      status: { $ne: "DELIVERED" },
    });

    res.json({
      count: fullCount + spareCount + orderCount,
    });
  } catch (error) {
    console.error("UNREAD COUNT ERROR:", error);
    res.status(500).json({ message: "Count failed" });
  }
};
