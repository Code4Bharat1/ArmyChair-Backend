import Mongoose from "mongoose";

export const connectDB = async () => {
  try {
    await Mongoose.connect(process.env.MONGO_URL, 
        console.log("MongoDB connected"));
    } catch (error) {   
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
};