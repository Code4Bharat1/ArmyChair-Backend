import Return from "../models/return.model.js";
import Inventory from "../models/inventory.model.js";
import Order from "../models/order.model.js";
import BadReturn from "../models/badReturn.model.js";
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
    const returns = await Return.find()
    .populate("returnedFrom", "name")
    .sort({ createdAt: -1 });
    

    const formatted = returns.map(r => ({
      _id: r._id,
      orderId: r.orderId,
      chairType: r.chairType,
      quantity: r.quantity,
      returnedFrom: r.returnedFrom,   // Mansi
      deliveryDate: r.deliveryDate,
      returnDate: r.returnDate,
      category: r.category,
      status: r.status, 
      movedToInventory: r.movedToInventory
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
    const { decision, remarks, inventoryType } = req.body;

    const returnItem = await Return.findById(req.params.id);
    if (!returnItem) {
      return res.status(404).json({ message: "Return not found" });
    }

   if (["Accepted", "Rejected"].includes(returnItem.status)) {
  return res.status(400).json({
    message: "Return already processed",
  });
}


    // ✅ Update return status
    returnItem.status = decision;
    returnItem.fittingDecision = decision;
    returnItem.fittingRemarks = remarks || "";
    await returnItem.save();

    // ✅ Inventory update ONLY if accepted
    if (decision === "Accepted") {

  /* ✅ GOOD → ADD TO INVENTORY */
  if (inventoryType === "GOOD") {
    await Inventory.findOneAndUpdate(
      {
        partName: returnItem.chairType,
        type: "SPARE",
        location: "WAREHOUSE",
      },
      {
        $inc: { quantity: returnItem.quantity },
        $setOnInsert: {
          partName: returnItem.chairType,
          type: "SPARE",
          location: "WAREHOUSE",
          createdBy: req.user.id,
          createdByRole: req.user.role,
        },
      },
      { upsert: true }
    );
  }

  /* ❌ BAD → STORE SEPARATELY */
  if (inventoryType === "BAD") {
    await BadReturn.create({
      orderId: returnItem.orderId,
      chairType: returnItem.chairType,
      quantity: returnItem.quantity,
      reason: returnItem.fittingRemarks,
      returnedFrom: returnItem.returnedFrom,
      createdBy: req.user.id,
    });
  }
}


    res.status(200).json({
      success: true,
      message: "Fitting decision processed successfully",
    });
  } catch (error) {
    console.error("Fitting decision error:", error);
    res.status(500).json({ message: error.message });
  }
};
