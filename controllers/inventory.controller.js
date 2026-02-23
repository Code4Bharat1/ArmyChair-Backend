import Inventory from "../models/inventory.model.js";
import Order from "../models/order.model.js";
import mongoose from "mongoose";
import { logActivity } from "../utils/logActivity.js";
import XLSX from "xlsx";
import Vendor from "../models/vendor.model.js";

const getStockStatus = (qty, minQty = 1, maxQty) => {
  if (qty === 0) return "Critical";

  if (maxQty) {
    if (qty < Math.ceil(maxQty * 0.2)) return "Low Stock";
    if (qty > maxQty) return "Overstocked";
  }

  return "Healthy";
};
const normalizeKey = (key = "") =>
  key.toString().toLowerCase().replace(/\s|_/g, "");

const COLUMN_MAP = {
  partName: ["partname", "part", "sparepart", "sparepartname"],
  vendor: ["vendor", "supplier", "company"],
  location: ["location", "loc", "rack", "bin"],
  quantity: ["quantity", "qty", "stock"],
  maxQuantity: ["maxquantity", "maxqty", "capacity"],
};
const FULL_COLUMN_MAP = {
  chairType: ["chairname", "chair", "model", "product", "productname"],
  vendor: ["vendor", "supplier", "company"],
  quantity: ["quantity", "qty", "stock"],
  colour: ["colour", "color"],
  mesh: ["mesh"],
  remark: ["remark", "note", "comment"],
  location: ["location", "warehouse", "loc"],
  maxQuantity: ["maxquantity", "maxqty"],
};

const getValue = (row, keys) => {
  for (const key of Object.keys(row)) {
    const normalized = normalizeKey(key);
    if (keys.includes(normalized)) {
      return row[key];
    }
  }
  return undefined;
};



//  CREATE INVENTORY ITEM
export const createInventory = async (req, res) => {
  try {
    const {
      chairType,
      colour,
      mesh,          // ✅
      remark,
      vendor,
      quantity,
      minQuantity,
      maxQuantity,
      location,
    } = req.body || {};


    if (
      !chairType ||
      !colour ||
      quantity === undefined ||
      minQuantity === undefined ||
      !location
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (vendor && !mongoose.Types.ObjectId.isValid(vendor)) {
      return res.status(400).json({ message: "Invalid vendor ID" });
    }

    const inventoryData = {
      chairType,
      colour,
      mesh: mesh?.trim() || "",
      remark: remark?.trim() || "",
      vendor,
      quantity: Number(quantity),
      minQuantity: Number(minQuantity),
      location,
      type: "FULL",
      createdBy: req.user?.id,
      createdByRole: req.user?.role,
    };

    if (req.user?.role === "admin" && maxQuantity !== undefined) {
      inventoryData.maxQuantity = Number(maxQuantity);
    }

    const inventory = await Inventory.findOneAndUpdate(
      {
        chairType,
        colour,
        location,
        type: "FULL",
      },
      {
        $inc: { quantity: Number(quantity) },

        // ✅ ALWAYS update metadata
        $set: {
          mesh: mesh?.trim() || "",
          remark: remark?.trim() || "",
        },

        // ✅ ONLY on first creation
        $setOnInsert: {
          chairType,
          colour,
          vendor,
          location,
          type: "FULL",
          minQuantity: Number(minQuantity),
          maxQuantity:
            req.user?.role === "admin" && maxQuantity !== undefined
              ? Number(maxQuantity)
              : 0,
          createdBy: req.user?.id,
          createdByRole: req.user?.role,
        },
      },
      { new: true, upsert: true }
    );



    res.status(201).json({
      message: "Inventory item added successfully",
      inventory,
    });
  } catch (error) {
    console.error("CREATE FULL INVENTORY ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};



//  GET ALL INVENTORY
export const getAllInventory = async (req, res) => {
  try {

    const inventory = await Inventory.find({})
      .populate("vendor", "name")
      .collation({ locale: "en", strength: 2 }) // case-insensitive
      .sort({
        chairType: 1,
        createdAt: -1,
      });

    const data = inventory.map((i) => ({
      ...i.toObject(),
      status:
        i.type === "FULL"
          ? getStockStatus(
            i.quantity,
            i.minQuantity,
            i.maxQuantity
          )
          : getStockStatus(
            i.quantity,
            i.minQuantity || 1,
            i.maxQuantity
          ),


    }));

    res.status(200).json({
      count: data.length,
      inventory: data,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//   UPDATE INVENTORY
export const updateInventory = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid inventory ID" });
    }

    const updateData = {};

    // 👑 ADMIN ONLY maxQuantity
    if (
      req.user?.role === "admin" &&
      req.body.maxQuantity !== undefined
    ) {
      updateData.maxQuantity = Number(req.body.maxQuantity);
    }


    if (req.body.chairType !== undefined) {
      updateData.chairType = req.body.chairType;
    }
    if (req.body.vendor !== undefined) {
      if (!mongoose.Types.ObjectId.isValid(req.body.vendor)) {
        return res.status(400).json({ message: "Invalid vendor ID" });
      }
      updateData.vendor = req.body.vendor;
    }


    if (req.body.quantity !== undefined) {
      updateData.quantity = Number(req.body.quantity);
    }

    if (req.body.minQuantity !== undefined) {
      updateData.minQuantity = Number(req.body.minQuantity);
    }

    if (req.body.colour !== undefined) {
      updateData.colour = req.body.colour;
    }
    if (req.body.mesh !== undefined) {
      updateData.mesh = req.body.mesh?.trim() || "";
    }

    if (req.body.remark !== undefined) {
      updateData.remark = req.body.remark?.trim();
    }

    const updatedInventory = await Inventory.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true },
    );

    if (!updatedInventory) {
      return res.status(404).json({ message: "Inventory not found" });
    }
    await logActivity(req, {
      action: "INVENTORY_UPDATE",
      module: "Inventory",
      entityType: "Inventory",
      entityId: updatedInventory._id,
      description: `Updated inventory ${updatedInventory.chairType}`,
    });

    res.status(200).json({
      message: "Inventory updated successfully",
      inventory: {
        ...updatedInventory.toObject(),
        status: getStockStatus(
          updatedInventory.quantity,
          updatedInventory.minQuantity,
          updatedInventory.maxQuantity
        ),

      },
    });
  } catch (error) {
    console.error("UPDATE INVENTORY ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

// DELETE INVENTORY
export const deleteInventory = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid inventory ID" });
    }

    const inventory = await Inventory.findByIdAndDelete(req.params.id);

    if (!inventory) {
      return res.status(404).json({ message: "Inventory not found" });
    }
    await logActivity(req, {
      action: "INVENTORY_DELETE",
      module: "Inventory",
      entityType: "Inventory",
      entityId: inventory._id,
      description: `Deleted inventory ${inventory.chairType}`,
    });

    res.status(200).json({
      message: "Inventory deleted successfully",
      inventory,
    });
  } catch (error) {
    console.error("DELETE INVENTORY ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

//Spare Parts Inventory

export const createSpareParts = async (req, res) => {
  try {
    const { partName, quantity, location, maxQuantity, remark, vendor } = req.body;

    if (!partName || quantity == null || !location) {
      return res.status(400).json({
        message: "partName, quantity and location are required",
      });
    }

    const qty = Number(quantity);

    // ✅ NORMALIZE PART NAME (CASE-SAFE)
    const normalizedPartName = partName.trim();

    // ✅ DERIVE LOCATION TYPE (CRITICAL)
    let locationType = "WAREHOUSE";
    if (location.startsWith("PROD_")) locationType = "PRODUCTION";
    if (location.startsWith("FIT_")) locationType = "FITTING";

    const sparePart = await Inventory.findOneAndUpdate(
      {
        partName: normalizedPartName,
        location: location.trim(),
        type: "SPARE",
      },
      {
        $inc: { quantity: qty },
        $setOnInsert: {
          partName: normalizedPartName,
          location: location.trim(),
          locationType,
          type: "SPARE",
          vendor, // ✅ ADD
          remark: remark?.trim() || "",
          maxQuantity:
            req.user?.role === "admin" && maxQuantity !== undefined
              ? Number(maxQuantity)
              : 0,
          createdBy: req.user?.id,
          createdByRole: req.user?.role,
        },
      },
      { new: true, upsert: true }
    );

    await logActivity(req, {
      action: "INVENTORY_CREATE",
      module: "Inventory",
      entityType: "Inventory",
      entityId: sparePart._id,
      description: `Created spare part ${sparePart.partName} at ${sparePart.location}`,
      destination: sparePart.location,
    });

    res.status(201).json({
      success: true,
      message: "Spare part added successfully",
      data: sparePart,
    });
  } catch (error) {
    console.error("Create spare part error:", error);
    res.status(500).json({ message: error.message });
  }
};
//get all spare parts
export const getSpareParts = async (req, res) => {
  try {
    const parts = await Inventory.find({
      type: "SPARE",
      locationType: { $nin: ["PRODUCTION", "FITTING"] },
    })
      .populate("vendor", "name")
      .populate("createdBy", "name role")
      .collation({ locale: "en", strength: 2 }) // case-insensitive
      .sort({
        partName: 1,     // A → Z
        createdAt: -1,   // newest first within same partName
      });

    const data = parts.map((p) => ({
      ...p.toObject(),
      status: getStockStatus(
        p.quantity,
        p.minQuantity || 1,
        p.maxQuantity
      ),
    }));

    res.status(200).json({
      success: true,
      inventory: data,
    });
  } catch (error) {
    console.error("GET SPARE PARTS ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};
// Update
export const updateSparePart = async (req, res) => {
  try {
    const { partName, location, quantity, maxQuantity, remark } = req.body;

    if (!partName || !location || quantity == null) {
      return res.status(400).json({
        message: "partName, location and quantity are required",
      });
    }

    const updateData = {
      partName,
      location,
      quantity: Number(quantity),
    };
    if (remark !== undefined) {
      updateData.remark = remark?.trim();
    }
    // 👑 ADMIN ONLY: allow updating maxQuantity
    if (
      req.user?.role === "admin" &&
      maxQuantity !== undefined
    ) {
      updateData.maxQuantity = Number(maxQuantity);
    }

    const updated = await Inventory.findOneAndUpdate(
      { _id: req.params.id, type: "SPARE" },
      updateData,
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Spare part not found" });
    }


    await logActivity(req, {
      action: "INVENTORY_UPDATE",
      module: "Inventory",
      entityType: "Inventory",
      entityId: updated._id,
      description: `Updated Spare part ${updated.partName} at ${updated.location}`,
    });

    res.json({
      success: true,
      message: "Spare part updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error("UPDATE SPARE PART ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};
// Delete
export const deleteSparePart = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Inventory.findOneAndDelete({
      _id: id,
      type: "SPARE",
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Spare part not found",
      });
    }

    // ✅ FIXED LOGGING
    await logActivity(req, {
      action: "DELETE_SPARE_PART",
      module: "Inventory",
      entityType: "Inventory",
      entityId: deleted._id,
      description: `Deleted spare part ${deleted.partName} from ${deleted.location}`,
      sourceLocation: deleted.location,
      destination: "DELETED",
    });

    res.json({
      success: true,
      message: "Spare part deleted successfully",
    });
  } catch (error) {
    console.error("Delete spare part error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const checkInventoryForOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    /* ================= SPARE ORDER ================= */
    if (order.orderType === "SPARE") {
      const spare = await Inventory.findOne({
        partName: order.chairModel,
        type: "SPARE",
      });

      return res.json({
        orderType: "SPARE",
        partName: order.chairModel,
        requiredQuantity: order.quantity,
        available: spare?.quantity || 0,
      });
    }

    /* ================= FULL ORDER ================= */
    const parts = await Inventory.find({
      chairType: order.chairModel,
      type: "SPARE",
    });

    if (parts.length === 0) {
      return res.json({
        orderType: "FULL",
        chairModel: order.chairModel,
        requiredQuantity: order.quantity,
        totalAvailable: 0,
        parts: [],
      });
    }

    const grouped = {};
    parts.forEach((p) => {
      if (!grouped[p.partName]) {
        grouped[p.partName] = 0;
      }
      grouped[p.partName] += p.quantity;
    });

    const partList = Object.entries(grouped).map(([partName, available]) => ({
      partName,
      available,
    }));

    const totalAvailable = Math.min(...partList.map((p) => p.available));

    res.json({
      orderType: "FULL",
      chairModel: order.chairModel,
      requiredQuantity: order.quantity,
      totalAvailable,
      parts: partList,
    });
  } catch (err) {
    console.error("Inventory check error:", err);
    res.status(500).json({ message: "Inventory check failed" });
  }
};

export const getChairModels = async (req, res) => {
  try {
    const fromInventory = await Inventory.find({ type: "FULL" }).distinct("chairType");
    const fromOrders = await Order.find({ orderType: "FULL" }).distinct("chairModel");
    const combined = [...new Set([...fromInventory, ...fromOrders])].filter(Boolean);
    res.json({ models: combined });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getSparePartNames = async (req, res) => {
  try {
    const fromInventory = await Inventory.find({ type: "SPARE" }).distinct("partName");
    const fromOrders = await Order.find({ orderType: "SPARE" }).distinct("chairModel");
    const combined = [...new Set([...fromInventory, ...fromOrders])].filter(Boolean);
    res.json({ parts: combined });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const bulkUploadSpareParts = async (req, res) => {
  try {
    const workbook = XLSX.read(req.file.buffer);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    let inserted = 0;

    for (const row of rows) {
      const partName = getValue(row, COLUMN_MAP.partName);
      const location = getValue(row, COLUMN_MAP.location);
      const quantity = getValue(row, COLUMN_MAP.quantity);
      const maxQuantity = getValue(row, COLUMN_MAP.maxQuantity);

      // ✅ REQUIRED FIELDS ONLY
      if (!partName || !location || quantity == null) continue;
      const qty = Number(quantity);
      if (Number.isNaN(qty) || qty <= 0) continue;

      // ✅ LOCATION TYPE
      let locationType = "WAREHOUSE";
      if (location.startsWith("PROD_")) locationType = "PRODUCTION";
      if (location.startsWith("FIT_")) locationType = "FITTING";

      const vendorName = getValue(row, COLUMN_MAP.vendor);

      let vendorDoc = null;
      if (vendorName) {
        vendorDoc = await Vendor.findOne({
          name: new RegExp(`^${vendorName.trim()}$`, "i"),
        });

        if (!vendorDoc) {
          vendorDoc = await Vendor.create({ name: vendorName.trim() });
        }
      }

      await Inventory.findOneAndUpdate(
        {
          partName: partName.trim(),
          location: location.trim(),
          type: "SPARE",
        },
        {
          $inc: { quantity: qty },
          $setOnInsert: {
            partName: partName.trim(),
            location: location.trim(),
            locationType,
            vendor: vendorDoc?._id,
            maxQuantity: maxQuantity ? Number(maxQuantity) : 0,
            type: "SPARE",
            createdBy: req.user.id,
            createdByRole: req.user.role,
          },
        },
        { upsert: true }
      );

      inserted++;
    }

    res.json({
      success: true,
      message: "Bulk upload completed",
      inserted,
    });
  } catch (err) {
    console.error("Bulk upload error", err);
    res.status(500).json({ message: err.message });
  }
};
export const bulkUploadFullChairs = async (req, res) => {
  try {
    const workbook = XLSX.read(req.file.buffer);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    let inserted = 0;

    for (const row of rows) {
      const chairType = getValue(row, FULL_COLUMN_MAP.chairType);
      const vendorName = getValue(row, FULL_COLUMN_MAP.vendor);
      const quantity = getValue(row, FULL_COLUMN_MAP.quantity);
      const colour = getValue(row, FULL_COLUMN_MAP.colour);
      const mesh = getValue(row, FULL_COLUMN_MAP.mesh);
      const remark = getValue(row, FULL_COLUMN_MAP.remark);
      const location = getValue(row, FULL_COLUMN_MAP.location) || "WAREHOUSE";
      const maxQuantity = getValue(row, FULL_COLUMN_MAP.maxQuantity);

      if (!chairType || !quantity || !colour) continue;

      // 🔹 FIND / CREATE VENDOR
      let vendorDoc = null;

      if (vendorName) {
        vendorDoc = await Vendor.findOne({
          name: new RegExp(`^${vendorName.trim()}$`, "i"),
        });

        if (!vendorDoc) {
          vendorDoc = await Vendor.create({ name: vendorName.trim() });
        }
      }

      await Inventory.findOneAndUpdate(
        {
          chairType: chairType.trim(),
          colour: colour.trim(),
          location: location.trim(),
          type: "FULL",
        },
        {
          $inc: { quantity: Number(quantity) },
          $set: {
            mesh: mesh?.trim() || "",
            remark: remark?.trim() || "",
          },
          $setOnInsert: {
            vendor: vendorDoc?._id,
            type: "FULL",
            minQuantity: 50,
            maxQuantity:
              req.user?.role === "admin" && maxQuantity
                ? Number(maxQuantity)
                : 0,
            createdBy: req.user.id,
            createdByRole: req.user.role,
          },
        },
        { upsert: true }
      );

      inserted++;
    }

    res.json({
      success: true,
      message: "Full chairs bulk upload completed",
      inserted,
    });
  } catch (err) {
    console.error("Bulk upload FULL chairs error", err);
    res.status(500).json({ message: err.message });
  }
};