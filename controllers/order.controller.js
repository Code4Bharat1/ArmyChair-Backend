import Order from "../models/order.model.js";

/* ================= CREATE ORDER ================= */
export const createOrder = async (req, res) => {
  try {
    const {
      orderId,
      dispatchedTo,
      chairModel,
      chairDetail,
      orderDate,
      deliveryDate,
      quantity,
      assembly,
      onTime,
      amount,
    } = req.body;

    const order = await Order.create({
      orderId,
      dispatchedTo,
      chairModel,
      chairDetail,
      orderDate,
      deliveryDate,
      quantity: Number(quantity),
      assembly,
      onTime,
      amount: Number(amount),
      progress: "warehouse", // ✅ default step
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

/* ================= GET ALL ORDERS ================= */
export const getOrders = async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      orders,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
    });
  }
};

/* ================= GET SINGLE ORDER ================= */
export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

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

/* ================= UPDATE ORDER ================= */
export const updateOrder = async (req, res) => {
  try {
    const allowedUpdates = [
      "dispatchedTo",
      "chairModel",
      "chairDetail",
      "deliveryDate",
      "quantity",
      "assembly",
      "onTime",
      "amount",
      "progress",
    ];

    const updates = {};
    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) {
        updates[key] =
          key === "quantity" || key === "amount"
            ? Number(req.body[key])
            : req.body[key];
      }
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

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
