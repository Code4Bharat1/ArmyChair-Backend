import Vendor from "../models/vendor.model.js";

//GET ALL VENDORS
export const getVendors = async (req, res) => {
    const vendors = await Vendor.find ({ isActive: true }).sort({ name:1 });
    return res.json(vendors);
};

// CREATE VENDORS IF NOT EXISTS
export const createVendor = async (name) => {
    if (!name) return null;

    const normalized = name.trim().toUpperCase();

    let vendor = await Vendor.findOne({ name: normalized });
    if(!vendor) {
        vendor = await Vendor.create({ name: normalized});
    }
    return vendor;
};