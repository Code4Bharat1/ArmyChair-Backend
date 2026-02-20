import mongoose from "mongoose";
const inventorySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["FULL", "SPARE"],
      required: true,
    },

    // FULL CHAIR ONLY
    chairType: {
      type: String,
      required: function () {
        return this.type === "FULL";
      },
    },

    // SPARE PART ONLY
    partName: {
      type: String,
      required: function () {
        return this.type === "SPARE";
      },
    },

    quantity: {
      type: Number,
      required: true,
    },

    location: {
      type: String,
      required: true,
    },
    locationType: {
      type: String,
      enum: ["WAREHOUSE", "PRODUCTION", "FITTING"],
      required: true,
    },
    colour: {
  type: String,
  trim: true,
},


    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: function () {
        return this.type === "FULL";
      },
    },

    minQuantity: {
      type: Number,
      required: function () {
        return this.type === "FULL";
      },
    },
    maxQuantity: {
      type: Number,
      default: 0,
    },


    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdByRole: String,
  },
  { timestamps: true }
);

// FULL chairs: unique per chairType + location
inventorySchema.index(
  { chairType: 1, location: 1 },
  {
    unique: true,
    partialFilterExpression: { type: "FULL" },
  }
);

// SPARE parts: unique per partName + location
inventorySchema.index(
  { partName: 1, location: 1 },
  {
    unique: true,
    partialFilterExpression: { type: "SPARE" },
  }
);
inventorySchema.pre("validate", function () {
  const loc = this.location?.trim().toUpperCase() || "";

  if (loc.startsWith("PROD_")) {
    this.locationType = "PRODUCTION";
  } else if (loc.startsWith("FIT_")) {
    this.locationType = "FITTING";
  } else {
    this.locationType = "WAREHOUSE";
  }
});


export default mongoose.model("Inventory", inventorySchema);
