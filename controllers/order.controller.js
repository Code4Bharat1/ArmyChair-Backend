import Order from "../models/order.model.js";

export const createOrder = async (req, res) => {
  try {
    const { dispatchedTo, chairModel, orderDate, quantity } = req.body;

    if (!dispatchedTo || !chairModel || !orderDate || !quantity) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const order = new Order({
      dispatchedTo,
      chairModel,
      orderDate,
      quantity: Number(quantity),
      createdBy: req.user?._id || req.user?.id,
      progress: "ORDER_PLACED",
    });

    await order.save(); // 🔥 orderId auto-generated here

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



export const getOrders = async (req, res) => {
  try {
    const { progress, mine } = req.query;

    const filter = {};

    if (progress) filter.progress = progress;

    if (mine === "true") filter.createdBy = req.user.id;

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .populate("createdBy", "name email");

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
    const order = await Order.findById(req.params.id).populate(
      "createdBy",
      "name email"
    );

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
    const allowedUpdates = [
      "dispatchedTo",
      "chairModel",
      "orderDate",
      "quantity",
    ];

    const updates = {};

    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) {
        updates[key] =
          key === "quantity" ? Number(req.body[key]) : req.body[key];
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

export const updateOrderProgress = async (req, res) => {
  try {
    const { progress } = req.body;

    const allowed = [
      "ORDER_PLACED",
      "WAREHOUSE_COLLECTED",
      "FITTING_IN_PROGRESS",
      "FITTING_COMPLETED",
      "READY_FOR_DISPATCH",
    ];

    if (!allowed.includes(progress)) {
      return res.status(400).json({ message: "Invalid progress" });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { progress },
      { new: true }
    );

    if (!order) return res.status(404).json({ message: "Order not found" });

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
