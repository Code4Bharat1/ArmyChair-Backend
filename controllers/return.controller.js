import Return from "../models/return.model.js";
import Inventory from "../models/inventory.model.js";
import Order from "../models/order.model.js";
import BadReturn from "../models/badReturn.model.js";
import User from "../models/User.model.js";
import ProductionInward from "../models/productionInward.model.js";
/**
 * CREATE RETURN ORDER
 * POST /api/returns
 */


export const createReturn = async (req, res) => {
  try {
    const { orderId, returnDate, category, description } = req.body;

    if (!orderId || !returnDate || !category) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    // 1️⃣ Fetch order
    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }


    if (order.status !== "Dispatched") {
      return res.status(400).json({
        message: "Return allowed only for dispatched orders",
      })
    }
    // 2️⃣ Prevent duplicate returns
    const exists = await Return.findOne({ orderId });
    if (exists) {
      return res.status(409).json({ message: "Return already exists" });
    }

    // 🔍 HARD LOG (important)
    console.log("ORDER DISPATCHED TO:", order.dispatchedTo);

    // 3️⃣ Create return
    const returnItem = await Return.create({
      orderId: order.orderId,
      chairType: order.chairModel,
      quantity: order.quantity,
      returnDate,
      deliveryDate: order.deliveryDate,
      category,
      vendor: order.salesPerson?.name || "Unknown",
      location: order.dispatchedTo,
      returnedFrom: order.dispatchedTo || "Unknown", // ✅ ABSOLUTE FIX
      description,
    });

    res.status(201).json({
      message: "Return created from order",
      data: returnItem,
    });

  } catch (error) {
    console.error("Create return error:", error);
    res.status(500).json({ message: error.message });
  }
};



/* GET ALL RETURNS*/
export const getAllReturns = async (req, res) => {
  try {
    const { status } = req.query;

    const filter = {};

    // Apply status filter if provided
    if (status) {
      filter.status = status;
    }

    const returns = await Return.find(filter)
      .populate("returnedFrom", "name")
      .sort({ createdAt: -1 });

    const formatted = returns.map(r => ({
      _id: r._id,
      orderId: r.orderId,
      chairType: r.chairType,
      quantity: r.quantity,
      returnedFrom: r.returnedFrom,
      deliveryDate: r.deliveryDate,
      returnDate: r.returnDate,
      category: r.category,
      status: r.status,
    }));

    res.status(200).json({
      success: true,
      data: formatted
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};



/**
 * MOVE RETURN TO INVENTORY
 * POST /api/returns/:id/move-to-inventory
 */
// export const moveReturnToInventory = async (req, res) => {
//   try {
//     const returnItem = await Return.findById(req.params.id);

//     if (!returnItem) {
//       return res.status(404).json({ message: "Return item not found" });
//     }

//     if (returnItem.movedToInventory) {
//       return res.status(400).json({ message: "Already moved to inventory" });
//     }

//     if (returnItem.category !== "Functional") {
//       return res.status(400).json({
//         message: "Only Functional items can be moved to inventory",
//       });
//     }

//     await Inventory.create({
//       chairType: returnItem.chairType,
//       color: "Returned",
//       vendor: returnItem.vendor,
//       quantity: returnItem.quantity,
//       minQuantity: 1,
//     });

//     returnItem.movedToInventory = true;
//     await returnItem.save();

//     res.status(200).json({
//       message: "Moved to inventory successfully",
//     });

//   } catch (error) {
//     console.error("Move to inventory failed:", error);
//     res.status(500).json({ message: error.message });
//   }
// };

export const moveReturnToFitting = async (req, res) => {
  try {
    const returnItem = await Return.findById(req.params.id);

    if (!returnItem) {
      return res.status(404).json({ message: "Return item not found" });
    }

    if (returnItem.status !== "Pending") {
      return res.status(400).json({
        message: "Return is already processed",
      });
    }

    // if (returnItem.category !== "Functional") {
    //   return res.status(400).json({
    //     message: "Only Functional items can be sent to fitting",
    //   });
    // }

    returnItem.status = "In-Fitting";
    await returnItem.save();

    res.status(200).json({
      message: "Return moved to fitting successfully",
    });

  } catch (error) {
    console.error("Move to fitting error:", error);
    res.status(500).json({ message: error.message });
  }
};
export const fittingDecision = async (req, res) => {
  try {
    const { decision, remarks, inventoryType, assignedTo } = req.body;

    const returnItem = await Return.findById(req.params.id);
    if (!returnItem) {
      return res.status(404).json({ message: "Return not found" });
    }

    // ✅ Prevent reprocessing
    // 🔒 STRICT lifecycle check
    if (returnItem.status !== "In-Fitting") {
      return res.status(400).json({
        message: `Return cannot be processed. Current status: ${returnItem.status}`,
      });
    }


    /* ================= REJECT ================= */
    if (decision === "Rejected") {
      returnItem.status = "Rejected";
      returnItem.fittingDecision = "Rejected";
      returnItem.fittingRemarks = remarks || "";
      await returnItem.save();

      return res.json({
        success: true,
        message: "Return rejected successfully",
      });
    }

    /* ================= ACCEPT FLOW ================= */
    if (decision !== "Accepted") {
      return res.status(400).json({
        message: "Invalid decision",
      });
    }

    if (!inventoryType) {
      return res.status(400).json({
        message: "Select GOOD or BAD",
      });
    }

    returnItem.fittingDecision = "Accepted";
    returnItem.fittingRemarks = remarks || "";

    /* ================= BAD ================= */
    if (inventoryType === "BAD") {
      returnItem.status = "Bad-Inventory";
      await returnItem.save();

      // prevent duplicate bad entry
      const exists = await BadReturn.findOne({ orderId: returnItem.orderId });
      if (!exists) {
        await BadReturn.create({
          orderId: returnItem.orderId,
          chairType: returnItem.chairType,
          quantity: returnItem.quantity,
          reason: remarks,
          returnedFrom: returnItem.returnedFrom,
          createdBy: req.user.id,
        });
      }

      return res.json({
        success: true,
        message: "Marked as bad inventory",
      });
    }

    /* ================= GOOD ================= */
    if (inventoryType === "GOOD") {

      if (!assignedTo) {
        return res.status(400).json({
          message: "Warehouse staff must be assigned",
        });
      }

      const warehouseUser = await User.findById(assignedTo);
      if (!warehouseUser || warehouseUser.role !== "warehouse") {
        return res.status(400).json({
          message: "Invalid warehouse user",
        });
      }

      returnItem.status = "Accepted";
      await returnItem.save();

      await ProductionInward.create({
        partName: returnItem.chairType,
        quantity: returnItem.quantity,
        assignedTo,
        createdBy: req.user.id,
        status: "PENDING",
      });

      return res.json({
        success: true,
        message: "Return sent to warehouse for approval",
      });
    }

  } catch (error) {
    console.error("Fitting decision error:", error);
    res.status(500).json({ message: error.message });
  }
};
