//order controller
import Order from "../models/order.model.js";

export const createOrder = async (req, res) => {
  try {
    const {
      dispatchedTo,
      chairModel,
      orderDate,
      deliveryDate,
      quantity,
      isPartial,
      salesPerson, // 👈 admin will send this
    } = req.body;

    if (!dispatchedTo || !chairModel || !orderDate || !deliveryDate || !quantity) {
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
      // sales creates order for self
      assignedSalesPerson = creatorId;
    }

    const order = new Order({
      dispatchedTo,
      chairModel,
      orderDate,
      deliveryDate,
      quantity: Number(quantity),
      isPartial: Boolean(isPartial),
      createdBy: creatorId,
      salesPerson: assignedSalesPerson,
      progress: "ORDER_PLACED",
    });

    await order.save();

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
    const filter = {};
    const role = req.user.role;
    const userId = req.user.id || req.user._id;

    if (role === "sales") {
      filter.salesPerson = userId;
    }

    if (role === "warehouse") {
      filter.isPartial = false;
    }

    // admin → no filter

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
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
      "deliveryDate",
      "quantity",
      "isPartial",
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
      "DISPATCHED",
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
