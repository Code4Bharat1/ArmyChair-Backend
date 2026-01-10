import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["admin", "user", "fitting", "sales", "warehouse"],
      default: "user",
    },

    mobile: {
      type: String,
      required: true,
      match: [/^[6-9]\d{9}$/, "Please enter a valid Indian mobile number"],
    },

    aadharNumber: {
      type: String,
      required: true,
      unique: true,
      match: [/^\d{12}$/, "Aadhar number must be 12 digits"],
    },
    photo: {
      type: String, // store image URL or file path (Cloudinary / S3 / local)
      default: "",
    },
    aadharPhotoFront: {
  type: String, // base64 or URL (Cloudinary/S3)
  required: true,
},

aadharPhotoBack: {
  type: String,
  required: true,
},

  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
