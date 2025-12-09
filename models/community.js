import mongoose from "mongoose";

const communitySchema = new mongoose.Schema({
  name: { type: {en: String, hi: String}, required: true },
  description: {en: String, hi: String},

  members: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }
  ],

  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Community", communitySchema);
