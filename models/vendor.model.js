import mongoose from "mongoose";

const vendorSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, unique: true, trim: true, uppercase: true },
        isActive: { type: Boolean, default: true }
    },

    { timestamp: true }
);

export default mongoose.model("Vendor", vendorSchema);