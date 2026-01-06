import mongoose from "mongoose";

/* =====================================
   Validate Inventory Request Body
   (Create & Update)
===================================== */
export const validateInventoryBody = (req, res, next) => {
  const { ProductName, VendorName, Quantity } = req.body;

  if (!ProductName || !VendorName || Quantity === undefined) {
    return res.status(400).json({
      message: "ProductName, VendorName and Quantity are required",
    });
  }

  if (typeof Quantity !== "number" || Quantity < 0) {
    return res.status(400).json({
      message: "Quantity must be a non-negative number",
    });
  }

  next();
};

/* =====================================
   Validate MongoDB Inventory ID
===================================== */
export const validateInventoryId = (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      message: "Invalid inventory ID",
    });
  }

  next();
};

/* =====================================
   Admin-Only Inventory Access
   (Update & Delete)
===================================== */
export const inventoryAdminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({
      message: "Admin access only",
    });
  }

  next();
};
