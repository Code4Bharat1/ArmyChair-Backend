import Inventory from "../models/inventory.model.js";
import Order from "../models/order.model.js";
import User from "../models/User.model.js";


export const getNotifications = async (req, res) => {
  try {
    const notifications = [];

    /* ================= FULL INVENTORY ================= */
    const fullItems = await Inventory.find({ type: "FULL" });

    fullItems.forEach((item) => {
      if (item.quantity === 0) {
        notifications.push({
          _id: `full-critical-${item._id}`,
          title: "Critical Stock Alert",
          message: `${item.chairType} (${item.color}) is out of stock`,
          redirectUrl: "/superadmin/inventory",
        });
      } 
      else if (item.quantity < item.minQuantity) {
        notifications.push({
          _id: `full-low-${item._id}`,
          title: "Low Stock Alert",
          message: `${item.chairType} (${item.color}) has only ${item.quantity} units`,
          redirectUrl: "/superadmin/inventory",
        });
      } 
      else if (item.maxQuantity && item.quantity > item.maxQuantity) {
        notifications.push({
          _id: `full-over-${item._id}`,
          title: "Overstock Alert",
          message: `${item.chairType} (${item.color}) exceeds max stock`,
          redirectUrl: "/superadmin/inventory",
        });
      }
    });

    /* ================= SPARE INVENTORY ================= */
    const spareItems = await Inventory.find({
      type: "SPARE",
      maxQuantity: { $exists: true },
    });

    spareItems.forEach((item) => {
      const lowThreshold = Math.ceil(item.maxQuantity * 0.2);

      if (item.quantity === 0) {
        notifications.push({
          _id: `spare-critical-${item._id}`,
          title: "Critical Spare Stock",
          message: `${item.partName} is out of stock`,
          redirectUrl: "/superadmin/spareparts",
        });
      } 
      else if (item.quantity < lowThreshold) {
        notifications.push({
          _id: `spare-low-${item._id}`,
          title: "Low Spare Stock",
          message: `${item.partName} has only ${item.quantity} units`,
          redirectUrl: "/superadmin/spareparts",
        });
      } 
      else if (item.quantity > item.maxQuantity) {
        notifications.push({
          _id: `spare-over-${item._id}`,
          title: "Overstock Alert",
          message: `${item.partName} exceeds max stock`,
          redirectUrl: "/superadmin/spareparts",
        });
      }
    });

    /* ================= DELAYED ORDERS ================= */
       const delayedOrders = await Order.find({
      deliveryDate: { $lt: new Date() },
      progress: { $ne: "DISPATCHED" },
    });

    delayedOrders.forEach(order => {
      notifications.push({
        _id: `order-delay-${order._id}`,
        title: "Order Delayed",
        message: `Order ${order.orderId} is delayed`,
        redirectUrl: "/superadmin/order",
        entityId: order._id,
      });
    });

    /* ================= AMENDED ORDERS ================= */
    const amendedOrders = await Order.find({
      lastAmendedAt: { $exists: true },
    });

    amendedOrders.forEach(order => {
      notifications.push({
        _id: `order-amend-${order._id}`,
        title: "Order Amended Before Dispatch",
        message: `Order ${order.orderId} was amended before dispatch`,
        redirectUrl: "/superadmin/order",
        entityId: order._id,
      });
    });

    res.status(200).json(notifications);
  } catch (error) {
    console.error("NOTIFICATION ERROR:", error);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
};

export const getUnreadCount = async (req, res) => {
  try {
    let count = 0;

    /* ================= FULL INVENTORY ================= */
    const fullItems = await Inventory.find(
      { type: "FULL" },
      { quantity: 1, minQuantity: 1, maxQuantity: 1 }
    );

    fullItems.forEach((item) => {
      if (
        item.quantity === 0 ||
        item.quantity < item.minQuantity ||
        (item.maxQuantity && item.quantity > item.maxQuantity)
      ) {
        count++;
      }
    });

    /* ================= SPARE INVENTORY ================= */
    const spareItems = await Inventory.find(
      { type: "SPARE", maxQuantity: { $exists: true } },
      { quantity: 1, maxQuantity: 1 }
    );

    spareItems.forEach((item) => {
      const lowThreshold = Math.ceil(item.maxQuantity * 0.2);

      if (
        item.quantity === 0 ||
        item.quantity < lowThreshold ||
        item.quantity > item.maxQuantity
      ) {
        count++;
      }
    });

    /* ================= DELAYED ORDERS ================= */
    const orderCount = await Order.countDocuments({
      deliveryDate: { $lt: new Date() },
      status: { $ne: "DELIVERED" },
    });

    res.json({
      count: count + orderCount,
    });
  } catch (error) {
    console.error("UNREAD COUNT ERROR:", error);
    res.status(500).json({ message: "Unread count failed" });
  }
};

