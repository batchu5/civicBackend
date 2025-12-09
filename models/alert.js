import mongoose from "mongoose";

const alertSchema = new mongoose.Schema(
  {
    title: { type: {en: String, hi: String}, required: true },
    message: { type: {en: String, hi: String}, required: true },
    department: { type: {en: String, hi: String}, required: true },
  },
  { timestamps: true }
);

export default mongoose.model("Alert", alertSchema);
