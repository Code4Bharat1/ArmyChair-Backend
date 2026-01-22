import Inventory from "../models/inventory.model.js";
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

    let dest = await Inventory.findOne(destQuery);

    /* ===== CREATE DEST IF NOT EXISTS ===== */
    if (!dest) {
      dest = new Inventory({
        ...destQuery,
        quantity: 0,
        minQuantity: source.type === "FULL" ? source.minQuantity : undefined,
        maxQuantity: source.maxQuantity, // 👈 ADD THIS
        createdBy: req.user?.id,
        createdByRole: req.user?.role,
      });
    }
    if (dest.maxQuantity && dest.quantity + qty > dest.maxQuantity) {
      return res.status(400).json({
        message: "Transfer exceeds maximum allowed stock for destination",
      });
    }


    /* ===== UPDATE STOCK ===== */
    source.quantity -= qty;
    dest.quantity += qty;

    await source.save();
    await dest.save();

    /* ===== LOG ===== */
    await logActivity(req, {
      action: "TRANSFER",
      module: "Inventory",
      entityType: "Inventory",
      entityId: source._id,
      description:
        source.type === "SPARE"
          ? `Transferred ${qty} ${source.partName} from ${source.location} to ${toLocation}`
          : `Transferred ${qty} ${source.chairType} from ${source.location} to ${toLocation}`,
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
    const movements = await activityLogModel.find({
      action: "TRANSFER",
      module: "Inventory",
      isDeleted: false,
    }).sort({ createdAt: -1 });

    res.json({ movements });
  } catch (err) {
    console.error("GET STOCK MOVEMENTS ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

