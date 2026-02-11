
import Inventory from "../models/inventory.model.js";
import StockMovement from "../models/stockMovement.model.js";

import { logActivity } from "../utils/logActivity.js";
  import activityLogModel from "../models/activityLog.model.js";
  export const transferInventory = async (req, res) => {
    try {
      const { sourceId, toLocation, quantity } = req.body;

      if (!sourceId || !toLocation || quantity == null) {
        return res.status(400).json({ message: "All fields are required" });
      }

      const qty = Number(quantity);
      if (qty <= 0) {
        return res.status(400).json({ message: "Invalid quantity" });
      }

      /* ===== FIND SOURCE ===== */
      const source = await Inventory.findById(sourceId);
      if (!source) {
        return res.status(404).json({ message: "Source inventory not found" });
      }

      if (source.location === toLocation) {
        return res
          .status(400)
          .json({ message: "Source and destination cannot be same" });
      }

      if (source.quantity < qty) {
        return res.status(400).json({ message: "Insufficient stock" });
      }

      /* ===== DEST QUERY ===== */
      const destQuery =
        source.type === "SPARE"
          ? {
            type: "SPARE",
            partName: source.partName,
            location: toLocation,
          }
          : {
            type: "FULL",
            chairType: source.chairType,
            vendor: source.vendor,
            location: toLocation,
          };

     /* ===== UPDATE SOURCE ===== */
source.quantity -= qty;
await source.save();

/* ===== UPDATE OR CREATE DEST SAFELY ===== */
await Inventory.findOneAndUpdate(
  destQuery,
  {
    $inc: { quantity: qty },
    $setOnInsert: {
      locationType:
        toLocation.startsWith("PROD_")
          ? "PRODUCTION"
          : toLocation.startsWith("FIT_")
          ? "FITTING"
          : "WAREHOUSE",

      minQuantity: source.type === "FULL" ? source.minQuantity : undefined,
      maxQuantity: source.maxQuantity,
      createdBy: req.user?.id,
      createdByRole: req.user?.role,
    },
  },
  {
    upsert: true,
    new: true,
    runValidators: true,
  }
);

/* ===== SAVE STOCK MOVEMENT ===== */
await StockMovement.create({
  partName: source.type === "SPARE" ? source.partName : undefined,
  chairType: source.type === "FULL" ? source.chairType : undefined,
  fromLocation: source.location,
  toLocation: toLocation,
  quantity: qty,
  movedBy: req.user?._id || req.user?.id,
  reason: "TRANSFER",
});

      /* ===== LOG ===== */
      await logActivity(req, {
    action: "TRANSFER",
    module: "Inventory",
    entityType: "Inventory",
    entityId: source._id,
    quantity: qty, // ✅ ADD THIS
    description:
      source.type === "SPARE"
        ? `Transferred ${qty} ${source.partName}`
        : `Transferred ${qty} ${source.chairType}`,
    sourceLocation: source.location,
    destination: toLocation,
  });

    

      res.json({
        success: true,
        message: "Inventory transferred successfully",
      });
    } catch (err) {
      console.error("TRANSFER ERROR:", err);
      res.status(500).json({ message: err.message });
    }
  };
export const getStockMovements = async (req, res) => {
  try {
    const movements = await StockMovement.find()
      .populate("movedBy", "name role")
      .sort({ createdAt: -1 });

    res.json({ movements });
  } catch (err) {
    console.error("GET STOCK MOVEMENTS ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};


