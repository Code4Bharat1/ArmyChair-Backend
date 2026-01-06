import Inventory from "../models/inventory.model.js";

/* ============================
   CREATE INVENTORY ITEM
   (Admin + User allowed)
============================ */
export const createInventory = async (req, res) => {
  try {
    const { ProductName, VendorName, Quantity } = req.body;

    if (!ProductName || !VendorName || Quantity === undefined) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Optional: attach who added the item
    const inventory = await Inventory.create({
      ProductName,
      VendorName,
      Quantity,
      createdBy: req.user?.id, // requires auth middleware
      createdByRole: req.user?.role,
    });

    res.status(201).json({
      message: "Inventory item added successfully",
      inventory,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ============================
   GET ALL INVENTORY
   (Admin + User)
============================ */
export const getAllInventory = async (req, res) => {
  try {
    const inventory = await Inventory.find()
      .sort({ createdAt: -1 });

    res.status(200).json(inventory);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ============================
   GET INVENTORY BY ID
============================ */
export const getInventoryById = async (req, res) => {
  try {
    const inventory = await Inventory.findById(req.params.id);

    if (!inventory) {
      return res.status(404).json({ message: "Inventory not found" });
    }

    res.status(200).json(inventory);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ============================
   UPDATE INVENTORY
   (Admin only)
============================ */
export const updateInventory = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin access only" });
    }

    const updatedInventory = await Inventory.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedInventory) {
      return res.status(404).json({ message: "Inventory not found" });
    }

    res.status(200).json({
      message: "Inventory updated successfully",
      inventory: updatedInventory,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ============================
   DELETE INVENTORY
   (Admin only)
============================ */
export const deleteInventory = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin access only" });
    }

    const inventory = await Inventory.findByIdAndDelete(req.params.id);

    if (!inventory) {
      return res.status(404).json({ message: "Inventory not found" });
    }

    res.status(200).json({ message: "Inventory deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
