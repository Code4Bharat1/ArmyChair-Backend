import mongoose from "mongoose";

const inventorySchema = new mongoose.Schema(
  {
    chairType: { type: String, required: true },
    quantity: { type: Number, required: true },
    vendor: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Vendor",
  required: true
},
        
    location: { type: String }, 

    type: {
      type: String,
      enum: ["FULL", "SPARE"],
      default: "FULL",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    
    createdByRole: {
      type: String,
      enum: ["admin", "user", "warehouse"],
    },

    color: {
      type : String,
      required : true,
    },
    minQuantity: {
      type: Number,
      required: true,
    },

    priority: {
      type: String,
      enum: ["high", "low"],
      default: "high",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Inventory", inventorySchema);
