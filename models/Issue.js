import mongoose from "mongoose";

const issueSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  // MULTILINGUAL DESCRIPTION
  description: {
    en: { type: String, required: true },
    hi: { type: String }
  },

  // MULTILINGUAL ISSUE TYPE
  issueType: {
    en: { type: String },
    hi: { type: String }
  },

  // MULTILINGUAL PRIORITY
  priority: {
    en: { type: String },
    hi: { type: String }
  },

  image: { type: String },

  // LOCATION
  geoLocation: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point"
    },
    coordinates: {
      type: [Number],
      required: true
    }
  },

  locationDetails: {
    latitude: Number,
    longitude: Number,
    accuracy: Number,
    altitude: Number,
    heading: Number,
    altitudeAccuracy: Number,
    speed: Number
  },

  likes: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  ],

  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Staff"
  },

  // MULTILINGUAL STATUS
  status: {
    en: {
      type: String,
      enum: ["pending", "assigned", "in-progress", "resolved"],
      default: "pending"
    },
    hi: { type: String }
  },

  date: { type: Date, default: Date.now }
});

// GEO INDEX
issueSchema.index({ geoLocation: "2dsphere" });

const Issue = mongoose.model("Issue", issueSchema);
export default Issue;
