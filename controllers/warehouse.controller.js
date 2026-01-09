import Order from "../models/order.model.js";
import Inventory from "../models/inventory.model.js";
import mongoose from "mongoose";
export const getOrderPickData = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order)
      return res.status(404).json({ success: false, message: "Order not found" });

    const spareStock = await Inventory.find({ type: "SPARE" });

    // group by part name
    const grouped = {};

    for (const item of spareStock) {
      if (!grouped[item.chairType]) grouped[item.chairType] = [];

      grouped[item.chairType].push({
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

    if (order.progress !== "ORDER_PLACED") {
      throw new Error("Order already processed by warehouse");
    }

    for (const item of items) {
      const stock = await Inventory.findById(item.inventoryId).session(session);

      if (!stock || stock.type !== "SPARE") {
        throw new Error("Invalid inventory item");
      }

      if (stock.quantity < item.qty) {
        throw new Error(
          `Not enough stock at ${stock.location} for ${stock.chairType}`
        );
      }

      stock.quantity -= item.qty;
      await stock.save({ session });
    }

    order.progress = "WAREHOUSE_COLLECTED";
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.json({ success: true, message: "Parts sent to fitting" });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    console.error("Dispatch Error:", err);
    res.status(400).json({ success: false, message: err.message });
  }
};