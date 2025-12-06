import mongoose from "mongoose";

const issueSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  description: { type: String, required: true },
  image: { type: String },
  priority: {type: String},
  issueType: {type: String},

  geoLocation: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
    },
    coordinates: {
      type: [Number],
      required: true,
    },
  },

  locationDetails: {
    latitude: Number,
    longitude: Number,
    accuracy: Number,
    altitude: Number,
    heading: Number,
    altitudeAccuracy: Number,
    speed: Number,
  },

  likes: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Staff",
  },

  status: {
    type: String,
    enum: ["pending", "assigned", "in-progress", "resolved"],
    default: "pending",
  },


  date: { type: Date, default: Date.now },
});
issueSchema.index({ geoLocation: "2dsphere" });

const Issue = mongoose.model("Issue", issueSchema);
export default Issue;
