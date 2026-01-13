import Inventory from "../models/inventory.model.js";
import StockMovement from "../models/stockMovement.model.js";

export const transferStock = async (req, res) => {
  try {
    const { sourceId, toLocation, quantity } = req.body;

    if (!sourceId || !toLocation || !quantity) {
      return res.status(400).json({ message: "All fields required" });
    }

    const qty = Number(quantity);

    if (qty <= 0) {
      return res.status(400).json({ message: "Invalid quantity" });
    }

    /* ===== FIND SOURCE ===== */
    const source = await Inventory.findById(sourceId);

    if (!source) {
      return res.status(404).json({ message: "Source stock not found" });
    }

    if (source.location === toLocation) {
      return res.status(400).json({ message: "Source and destination same" });
    }

    if (source.quantity < qty) {
      return res.status(400).json({ message: "Insufficient stock" });
    }

    /* ===== FIND / CREATE DEST ===== */
    let dest = await Inventory.findOne({
      chairType: source.chairType,
      vendor: source.vendor,
      location: toLocation,
      type: source.type,
    });

    if (!dest) {
      dest = new Inventory({
        chairType: source.chairType,
        vendor: source.vendor,
        location: toLocation,
        quantity: 0,
        type: source.type,
      });
    }

    /* ===== UPDATE ===== */
    source.quantity -= qty;
    dest.quantity += qty;

    await source.save();
    await dest.save();

    /* ===== LOG ===== */
    await StockMovement.create({
      chairType: source.chairType,
      fromLocation: source.location,
      toLocation,
      quantity: qty,
      movedBy: req.user?.id,
      reason: "TRANSFER",
    });

    res.json({ success: true, message: "Stock transferred successfully" });
  } catch (err) {
    console.error("TRANSFER ERROR:", err);
    res.status(500).json({ message: "Transfer failed" });
  }
};


export const getStockMovements = async (req, res) => {
  try {
    const movements = await StockMovement.find()
      .populate("movedBy", "name email role")
      .sort({ createdAt: -1 });

    res.json({ success: true, movements });
  } catch (err) {
    console.error("MOVEMENT FETCH ERROR:", err);
    res.status(500).json({ message: "Failed to fetch stock movements" });
  }
};
