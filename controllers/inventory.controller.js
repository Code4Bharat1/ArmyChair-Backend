import Inventory from "../models/inventory.model.js";
import Order from "../models/order.model.js";
import mongoose from "mongoose";
import { logActivity } from "../utils/logActivity.js";
import XLSX from "xlsx";
import Vendor from "../models/vendor.model.js";

const getStockStatus = (qty, minQty = 0, maxQty = null) => {
  const quantity = Number(qty);
  const min = Number(minQty || 0);
  const max = maxQty !== undefined && maxQty !== null
    ? Number(maxQty)
    : null;

  if (quantity < min) return "Critical";
  if (quantity === min) return "Low Stock";
  if (max !== null && quantity > max) return "Overstocked";

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
  minQuantity: ["minquantity", "minqty", "minimum"],
  chalanNo: ["chalano", "chalan", "billno", "bill", "invoiceno"],
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
  chalanNo: ["chalano", "chalan", "billno", "bill", "bilno", "invoiceno"],
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
    // Destructure chalanNo from req.body
    const {
      chairType,
      colour,
      mesh,
      remark,
      vendor,
      quantity,
      minQuantity,
      maxQuantity,
      location,
      chalanNo,
    } = req.body || {};



    // Add to required fields check:
    if (!chairType || !colour || quantity === undefined || minQuantity === undefined || !location || !chalanNo) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Add to inventoryData object:
    const inventoryData = {
      chairType,
      colour,
      mesh: mesh?.trim() || "",
      remark: remark?.trim() || "",
      chalanNo: chalanNo.trim(),   // ✅ ADD
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
      { chairType, colour, location, vendor, type: "FULL" },
      {
        $inc: { quantity: Number(quantity) },
        $set: {
          mesh: mesh?.trim() || "",
          remark: remark?.trim() || "",
          chalanNo: chalanNo.trim(),   // ✅ ADD — always update with latest
        },
        $setOnInsert: {
          chairType,
          colour,
          vendor,
          location,
          type: "FULL",
          minQuantity: Number(minQuantity),
          // maxQuantity:
          //   req.user?.role === "admin" && maxQuantity !== undefined
          //     ? Number(maxQuantity)
          //     : 0,
          maxQuantity: maxQuantity !== undefined ? Number(maxQuantity) : 0,
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
    const inventory = await Inventory.find({
      // ✅ Only show items physically at the warehouse
      // Excludes FITTING_SECTION, PRODUCTION, etc.
      locationType: { $nin: ["PRODUCTION", "FITTING"] },
    })
      .populate("vendor", "name")
      .collation({ locale: "en", strength: 2 })
      .sort({
        chairType: 1,
        createdAt: -1,
      });

    const data = inventory.map((i) => ({
      ...i.toObject(),
      status: getStockStatus(
        i.quantity,
        i.minQuantity,
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

export const getProductionInventory = async (req, res) => {
  try {
    const { location } = req.query; // optional: filter by specific PROD_ location

    const filter = {
      locationType: "PRODUCTION",
      type: "SPARE",
    };

    if (location) {
      filter.location = location;
    }

    const parts = await Inventory.find(filter)
      .populate("vendor", "name")
      .sort({ partName: 1 });

    res.status(200).json({
      success: true,
      inventory: parts,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getFittingStock = async (req, res) => {
  try {
    const parts = await Inventory.find({
      locationType: "FITTING",
    })
      .populate("vendor", "name")
      .sort({ chairType: 1, partName: 1 });

    res.status(200).json({
      success: true,
      data: parts,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
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
    // if (
    //   req.user?.role === "admin" &&
    //   req.body.maxQuantity !== undefined
    // ) {
    //   updateData.maxQuantity = Number(req.body.maxQuantity);
    // }
    if (req.body.maxQuantity !== undefined) {
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
    if (req.body.chalanNo !== undefined) {
      updateData.chalanNo = req.body.chalanNo?.trim();
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
    const {
      partName,
      quantity,
      minQuantity,
      location,
      maxQuantity,
      remark,
      vendor,
      chalanNo,
    } = req.body;

    if (!partName || quantity == null || !location) {
      return res.status(400).json({
        message: "partName, quantity and location are required",
      });
    }

    const qty = Number(quantity);
    const normalizedPartName = partName.trim();
    const normalizedLocation = location.trim();

    // ✅ Derive locationType from location string (mirrors the schema hook)
    let locationType = "WAREHOUSE";
    if (normalizedLocation.startsWith("PROD_")) locationType = "PRODUCTION";
    if (normalizedLocation.startsWith("FIT_") || normalizedLocation === "FITTING_SECTION") locationType = "FITTING";

    let vendorId = null;
    if (vendor) {
      if (mongoose.Types.ObjectId.isValid(vendor)) {
        vendorId = vendor;
      } else {
        let vendorDoc = await Vendor.findOne({
          name: new RegExp(`^${vendor.trim()}$`, "i"),
        });
        if (!vendorDoc) {
          vendorDoc = await Vendor.create({ name: vendor.trim() });
        }
        vendorId = vendorDoc._id;
      }
    }

    // ✅ Filter matches the unique index: partName + location + type only
    const filter = {
      partName: normalizedPartName,
      location: normalizedLocation,
      vendor: vendorId || null,
      type: "SPARE",
    };

    const update = {
      $inc: { quantity: qty },

      $set: {
        chalanNo: chalanNo?.trim() || "",
        remark: remark?.trim() || "",
      },

      $setOnInsert: {
        partName: normalizedPartName,
        location: normalizedLocation,
        locationType,
        type: "SPARE",
        vendor: vendorId || null,
        minQuantity: Number(minQuantity || 0),
        maxQuantity: maxQuantity !== undefined ? Number(maxQuantity) : 0,
        createdBy: req.user?.id,
        createdByRole: req.user?.role,
      },
    };

    const sparePart = await Inventory.findOneAndUpdate(filter, update, {
      new: true,
      upsert: true,
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
        p.minQuantity,
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
    const {
      partName,
      location,
      quantity,
      minQuantity,   // ✅ ADD
      maxQuantity,
      remark
    } = req.body;

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
    // if (
    //   req.user?.role === "admin" &&
    //   maxQuantity !== undefined
    // ) {
    //   updateData.maxQuantity = Number(maxQuantity);
    // }
    if (maxQuantity !== undefined) {
      updateData.maxQuantity = Number(maxQuantity);
    }

    if (req.body.minQuantity !== undefined) {
      updateData.minQuantity = Number(req.body.minQuantity);
    }
    if (req.body.chalanNo !== undefined) {
      updateData.chalanNo = req.body.chalanNo?.trim();
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
      const minQuantity = getValue(row, COLUMN_MAP.minQuantity);
      const chalanNo = getValue(row, COLUMN_MAP.chalanNo);

      // ✅ REQUIRED FIELDS ONLY
      if (!partName || !location || quantity == null) continue;
      const qty = Number(quantity);
      if (Number.isNaN(qty) || qty <= 0) continue;

      // ✅ LOCATION TYPE
      const normalizedLocation = String(location || "").trim();
      const loc = normalizedLocation.toUpperCase();

      let locationType = "WAREHOUSE";

      if (normalizedLocation.startsWith("PROD_"))
        locationType = "PRODUCTION";

      if (
        normalizedLocation.startsWith("FIT_") ||
        normalizedLocation === "FITTING_SECTION"
      )
        locationType = "FITTING";
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
          location: normalizedLocation,
          vendor: vendorDoc?._id || null,
          type: "SPARE"
        },
        {
          $inc: { quantity: qty },

          $set: {
            chalanNo: chalanNo?.trim() || ""
          },

          $setOnInsert: {
            partName: partName.trim(),
            location: normalizedLocation,
            locationType,
            vendor: vendorDoc?._id || null,
            type: "SPARE",
            minQuantity: minQuantity ? Number(minQuantity) : 0,
            maxQuantity: maxQuantity ? Number(maxQuantity) : 0,
            createdBy: req.user.id,
            createdByRole: req.user.role
          }
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
      const chalanNo = getValue(row, FULL_COLUMN_MAP.chalanNo);

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
          vendor: vendorDoc?._id || null,
          type: "FULL",
        },
        {
          $inc: { quantity: Number(quantity) },

          $set: {
            mesh: mesh?.trim() || "",
            remark: remark?.trim() || "",
            chalanNo: chalanNo?.trim() || "",
          },

          $setOnInsert: {
            vendor: vendorDoc?._id || null,
            type: "FULL",
            minQuantity: 50,
            maxQuantity: maxQuantity !== undefined ? Number(maxQuantity) : 0,
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

// inventory.controller.js
export const getInventoryLocations = async (req, res) => {
  try {
    const locations = await Inventory.distinct("location", {
      locationType: "WAREHOUSE",   // ✅ THIS IS THE KEY
    });

    res.json({ locations });
  } catch (err) {
    console.error("GET LOCATIONS ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};