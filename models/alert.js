import mongoose from "mongoose";

const alertSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    message: { type: String, required: true },
    department: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.model("Alert", alertSchema);
