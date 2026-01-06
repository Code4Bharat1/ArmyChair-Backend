import mongoose from "mongoose";
const rawSchema = new mongoose.Schema(
    {
        ProductName:{type:String, required:true},
        type:{type:String, required:true},
        colour:{type:String, required:true},
        setNo: {type:String, required:true},
    },
    {timestamp:true}
)

export default mongoose.model("Raw", rawSchema);