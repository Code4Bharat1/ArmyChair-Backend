import Return from "../models/return.model.js";
import Inventory from "../models/inventory.model.js";
import Order from "../models/order.model.js";
import BadReturn from "../models/badReturn.model.js";
import User from "../models/User.model.js";
// ✅ ProductionInward import removed — returns do NOT create inward requests

// ─── createReturn ───────────────────────────────────────────────
export const createReturn = async (req, res) => {
  try {
    const { orderId, returnDate, category, description, items } = req.body;

    if (!orderId || !returnDate || !category || !items?.length) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    const order = await Order.findOne({ orderId });
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.progress !== "DISPATCHED") {
      return res.status(400).json({ message: "Return allowed only for dispatched orders" });
    }

    // Allow multiple returns per order BUT prevent duplicate category for same order
    const exists = await Return.findOne({ orderId, category });
    if (exists) return res.status(409).json({
      message: `A ${category} return already exists for order ${orderId}`,
    });

    // Validate each returned SKU against order items
    const orderItems = order.items?.length
      ? order.items
      : [{ name: order.chairModel, quantity: order.quantity }];

    for (const retItem of items) {
      const match = orderItems.find(
        (i) => i.name.toLowerCase().trim() === retItem.name.toLowerCase().trim()
      );
      if (!match) {
        return res.status(400).json({ message: `Item not in order: ${retItem.name}` });
      }
      if (retItem.quantity > match.quantity) {
        return res.status(400).json({
          message: `${retItem.name}: Cannot return ${retItem.quantity}, only ${match.quantity} was ordered`,
        });
      }
    }

    const totalQty = items.reduce((s, i) => s + i.quantity, 0);
    const chairTypeLabel = items.map((i) => `${i.name} (x${i.quantity})`).join(", ");

    const returnDoc = await Return.create({
      orderId:      order.orderId,
      chairType:    chairTypeLabel,
      orderType: order.orderType,
      items:        items.map((i) => ({
        name:          i.name,
        quantity:      i.quantity,
        fittingStatus: "PENDING",
      })),
      quantity:     totalQty,
      returnDate,
      deliveryDate: order.deliveryDate,
      category,
      vendor:       order.salesPerson?.name || "Unknown",
      location:     order.dispatchedTo,
      returnedFrom: order.dispatchedTo || "Unknown",
      description,
    });

    res.status(201).json({ message: "Return created", data: returnDoc });
  } catch (error) {
    console.error("Create return error:", error);
    res.status(500).json({ message: error.message });
  }
};

// ─── getAllReturns ───────────────────────────────────────────────
export const getAllReturns = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const returns = await Return.find(filter)
      .populate("returnedFrom", "name")
      .sort({ createdAt: -1 });

    const formatted = returns.map((r) => ({
      _id:              r._id,
      orderId:          r.orderId,
      chairType:        r.chairType,
       orderType:        r.orderType,
      items:            r.items || [],
      quantity:         r.quantity,
      returnedFrom:     r.returnedFrom,
      deliveryDate:     r.deliveryDate,
      returnDate:       r.returnDate,
      category:         r.category,
      status:           r.status,
      description:      r.description,
      movedToInventory: r.movedToInventory,
    }));

    res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── getReturnById ───────────────────────────────────────────────
export const getReturnById = async (req, res) => {
  try {
    const returnItem = await Return.findById(req.params.id).populate("returnedFrom", "name");
    if (!returnItem) return res.status(404).json({ message: "Return not found" });
    res.status(200).json({ success: true, data: returnItem });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── moveReturnToInventory ───────────────────────────────────────
export const moveReturnToInventory = async (req, res) => {
  try {
    const returnItem = await Return.findById(req.params.id);
    if (!returnItem) return res.status(404).json({ message: "Return not found" });

    if (returnItem.status !== "Accepted") {
      return res.status(400).json({ message: `Cannot add to inventory. Status: ${returnItem.status}` });
    }
    if (returnItem.movedToInventory) {
      return res.status(400).json({ message: "Already moved to inventory" });
    }

    const goodItems = returnItem.items?.length
      ? returnItem.items.filter((i) => i.fittingStatus === "GOOD")
      : [{ name: returnItem.chairType, quantity: returnItem.quantity }];

    if (!goodItems.length) {
      return res.status(400).json({ message: "No GOOD items to move to inventory" });
    }

    for (const item of goodItems) {
  const rawName = item.name.trim();

  // ✅ Try exact match first
  let existingStock = await Inventory.findOne({
    chairType: { $regex: `^${rawName}$`, $options: "i" },
    type: "FULL",
    locationType: "WAREHOUSE",
  }).sort({ quantity: -1 });

  // ✅ If no exact match, try stripping colour from name
  if (!existingStock) {
    const colourMatch = rawName.match(/\(([^)]+)\)\s*$/);
    if (colourMatch) {
      const baseName = rawName.replace(/\s*\([^)]+\)\s*$/, "").trim();
      const colour = colourMatch[1].trim();

      // Debug log — remove after testing
      const allMatches = await Inventory.find({
        type: "FULL",
        locationType: "WAREHOUSE",
        chairType: { $regex: baseName, $options: "i" },
      }).lean();
      console.log("DEBUG matches for", rawName, ":", JSON.stringify(
        allMatches.map(m => ({ chairType: m.chairType, colour: m.colour, qty: m.quantity }))
      ));

     existingStock = await Inventory.findOne({
  chairType: { $regex: `^${baseName}$`, $options: "i" },
  colour:    { $regex: `^${colour}$`, $options: "i" },
  type: "FULL",
  $or: [
    { locationType: "WAREHOUSE" },
    { locationType: { $exists: false } },  // ✅ catches old records without locationType
    { location: "WAREHOUSE" },
  ],
}).sort({ quantity: -1 });
    }
  }

  if (existingStock) {
    existingStock.quantity += item.quantity;
    await existingStock.save();
  } else {
    await Inventory.create({
      chairType:     rawName,
      colour:        "Unknown",
      location:      "WAREHOUSE",
      locationType:  "WAREHOUSE",
      type:          "FULL",
      quantity:      item.quantity,
      minQuantity:   0,
      maxQuantity:   0,
      remark:        `Returned from order ${returnItem.orderId}`,
      createdBy:     req.user?.id,
      createdByRole: req.user?.role,
    });
  }
}
    returnItem.movedToInventory = true;
    returnItem.status = "Completed";
    await returnItem.save();

    res.status(200).json({ success: true, message: "GOOD items added to inventory" });
  } catch (error) {
    console.error("Move to inventory error:", error);
    res.status(500).json({ message: error.message });
  }
};

// ─── moveReturnToFitting ─────────────────────────────────────────
export const moveReturnToFitting = async (req, res) => {
  try {
    const returnItem = await Return.findById(req.params.id);
    if (!returnItem) return res.status(404).json({ message: "Return item not found" });

    // ✅ ADD: Spare parts should never go to fitting
    if (returnItem.orderType === "SPARE") {
      return res.status(400).json({ message: "Spare part returns go directly to inventory, not fitting" });
    }

    if (returnItem.status !== "Pending") {
      return res.status(400).json({ message: "Return is already processed" });
    }

    returnItem.status = "In-Fitting";
    await returnItem.save();

    res.status(200).json({ message: "Return moved to fitting successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── fittingDecision ─────────────────────────────────────────────
export const fittingDecision = async (req, res) => {
  try {
    const { decisions, assignedTo } = req.body;

    if (!decisions?.length) {
      return res.status(400).json({ message: "decisions array required" });
    }

    const returnItem = await Return.findById(req.params.id);
    if (!returnItem) return res.status(404).json({ message: "Return not found" });

    if (returnItem.status !== "In-Fitting") {
      return res.status(400).json({
        message: `Return cannot be processed. Current status: ${returnItem.status}`,
      });
    }

    // Validate: GOOD items need a warehouse assignee
    const hasGood = decisions.some((d) => d.decision === "GOOD");
    if (hasGood) {
      if (!assignedTo) {
        return res.status(400).json({ message: "Warehouse staff must be assigned for GOOD items" });
      }
      const warehouseUser = await User.findById(assignedTo);
      if (!warehouseUser || warehouseUser.role !== "warehouse") {
        return res.status(400).json({ message: "Invalid warehouse user" });
      }
    }

    // Apply per-SKU decisions
    for (const dec of decisions) {
      const itemIdx = returnItem.items.findIndex(
        (i) => i.name.toLowerCase().trim() === dec.name.toLowerCase().trim()
      );
      if (itemIdx === -1) {
        return res.status(400).json({ message: `Item not found in return: ${dec.name}` });
      }
      returnItem.items[itemIdx].fittingStatus  = dec.decision; // "GOOD" | "BAD"
      returnItem.items[itemIdx].fittingRemarks = dec.remarks || "";
    }

    // ✅ BAD items → create BadReturn record
    const badDecisions = decisions.filter((d) => d.decision === "BAD");
    for (const bad of badDecisions) {
      const item = returnItem.items.find(
        (i) => i.name.toLowerCase().trim() === bad.name.toLowerCase().trim()
      );
      if (!item) continue;
      const alreadyExists = await BadReturn.findOne({
        orderId:   returnItem.orderId,
        chairType: item.name,
      });
      if (!alreadyExists) {
        await BadReturn.create({
          orderId:      returnItem.orderId,
          chairType:    item.name,
          quantity:     item.quantity,
          reason:       bad.remarks || "",
          returnedFrom: returnItem.returnedFrom,
          createdBy:    req.user.id,
        });
      }
    }

    // ✅ GOOD items — NO ProductionInward created.
    // The return status becomes "Accepted" below, which is how the
    // warehouse discovers these items in their "Returns to Inventory" tab.
    // They will call POST /returns/:id/move-to-inventory when ready.

    // Derive overall return status from all item decisions
    const allItems   = returnItem.items;
    const allDecided = allItems.every((i) => i.fittingStatus !== "PENDING");
    const allBad     = allItems.every((i) => i.fittingStatus === "BAD");
    const anyGood    = allItems.some((i)  => i.fittingStatus === "GOOD");

    if (allDecided) {
      if (allBad)       returnItem.status = "Rejected";
      else if (anyGood) returnItem.status = "Accepted"; // ← warehouse sees this in Returns tab
    }

    returnItem.markModified("items");
    await returnItem.save();

    res.json({
      success:      true,
      message:      "Fitting decisions saved",
      pendingCount: allItems.filter((i) => i.fittingStatus === "PENDING").length,
      status:       returnItem.status,
    });
  } catch (error) {
    console.error("Fitting decision error:", error);
    res.status(500).json({ message: error.message });
  }
};
// ─── moveSpareReturnToInventory ──────────────────────────────────
export const moveSpareReturnToInventory = async (req, res) => {
  try {
    const returnItem = await Return.findById(req.params.id);
    if (!returnItem) return res.status(404).json({ message: "Return not found" });

    if (returnItem.orderType !== "SPARE") {
      return res.status(400).json({ message: "This endpoint is only for SPARE order returns" });
    }
    if (returnItem.status !== "Pending") {
      return res.status(400).json({ message: "Return already processed" });
    }
    if (returnItem.movedToInventory) {
      return res.status(400).json({ message: "Already moved to inventory" });
    }

    for (const item of returnItem.items) {
      // ✅ Find the existing warehouse record for this part (any WAREHOUSE locationType)
      const existingStock = await Inventory.findOne({
        partName: { $regex: `^${item.name.trim()}$`, $options: "i" },
        type: "SPARE",
        locationType: "WAREHOUSE",
      }).sort({ quantity: -1 }); // pick the one with most stock if multiple

      if (existingStock) {
        // ✅ Add to the existing record
        existingStock.quantity += item.quantity;
        await existingStock.save();
      } else {
        // ✅ No existing record — create one at WAREHOUSE
        await Inventory.create({
          partName:      item.name,
          location:      "WAREHOUSE",
          locationType:  "WAREHOUSE",
          type:          "SPARE",
          quantity:      item.quantity,
          minQuantity:   0,
          maxQuantity:   0,
          remark:        `Returned from order ${returnItem.orderId}`,
          createdBy:     req.user?.id,
          createdByRole: req.user?.role,
        });
      }
    }

    returnItem.movedToInventory = true;
    returnItem.status = "Completed";
    await returnItem.save();

    res.status(200).json({ success: true, message: "Spare parts added to inventory" });
  } catch (error) {
    console.error("Move spare return to inventory error:", error);
    res.status(500).json({ message: error.message });
  }
};
// ─── getAllBadReturns ────────────────────────────────────────────
export const getAllBadReturns = async (req, res) => {
  try {
    const badReturns = await BadReturn.find()
      .populate("createdBy", "name role")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: badReturns });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};