import express from "express";
import jwt from "jsonwebtoken";
import Staff from "../models/Staff.js";
import Issue from "../models/Issue.js";
import protectStaff from "../middleware/staffAuthMiddleware.js";

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";


const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || "yourSecretKey", {
    expiresIn: "30d", 
  });
};


router.post("/signup", async (req, res) => {
  try {
    const { email, password, department, location } = req.body;

    if (!department) return res.status(400).json({ message: "Department required" });
    if (!location) return res.status(400).json({ message: "Location required" });

    const staff = await Staff.create({
      email,
      password,
      department,
      geoLocation: {
        type: "Point",
        coordinates: [location.coords.longitude, location.coords.latitude],
      },
    });

    const token = generateToken(staff._id);

    res.status(201).json({
      _id: staff._id,
      email: staff.email,
      department: staff.department,
      token,
    });
  } catch (err) {
    console.error("Staff registration error:", err);
    res.status(500).json({ message: err.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log("email", email);
    console.log("password", password);

    const staff = await Staff.findOne({ email });

    if (!staff) return res.status(404).json({ message: "Staff not found" });

    const isMatch = await staff.matchPassword(password);
    console.log("isMatch", isMatch);

    if (!isMatch) {
      console.log("ismatch is true");
      return res.status(401).json({ message: "Invalid credentials" })
    };

    await staff.save();
    
    const token = generateToken(staff._id);

    res.json({
      _id: staff._id,
      email: staff.email,
      department: staff.department,
      token,
    });
  } catch (err) {
    console.error("Staff login error:", err);
    res.status(500).json({ message: err.message });
  }
});

router.post("/token", protectStaff, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: "Token required" });

    const staff = await Staff.findById(req.user._id);
    staff.pushToken = token;
    await staff.save();

    res.status(200).json({ message: "Push token saved" , token: token});

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to save token" });
  }
});

router.get("/tasks", protectStaff, async (req, res) => {
  try {
    const staffId = req.user._id;
    console.log("/tasks is called");

    const staff = await Staff.findById(staffId)
      .populate({
        path: "assignedIssues",
        select: "description issueType locationDetails image status date",
      });

    if (!staff) {
      return res.status(404).json({ message: "Staff not found" });
    }

    console.log("Assigned tasks:", staff.assignedIssues);

    res.status(200).json(staff.assignedIssues);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    res.status(500).json({ message: "Failed to fetch tasks" });
  }
});

router.put("/issues/:id/update", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    console.log("id", id);
    if (!status || !id) {
      return res.status(400).json({ message: "Invalid or missing status value" });
    }

    const issue = await Issue.findById(id);
    if (!issue) {
      return res.status(404).json({ message: "Issue not found" });
    }
    console.log("Issue Found");

    issue.status = status;
    await issue.save();

    res.json({
      message: "Issue status updated successfully",
      issue,
    });

    
  } catch (error) {
    console.error("Error updating issue:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/nearby/:department/:issueId", async (req, res) => {
  try {
    console.log("nearby staff endpoint called");
    const { department, issueId } = req.params;

    const issue = await Issue.findById(issueId);
    if (!issue) return res.status(404).json({ message: "Issue not found" });

    const [lng, lat] = issue.geoLocation.coordinates;

    const nearbyStaff = await Staff.find({
      department,
      geoLocation: {
        $near: {
          $geometry: { type: "Point", coordinates: [lng, lat] },
          $maxDistance: 5000,
        },
      },
    }).select("-password");
    console.log("nearbyStaff",nearbyStaff);
    res.status(200).json({
      message:
        nearbyStaff.length > 0
          ? "Nearby staff members found"
          : "No nearby staff found within 5 km",
      count: nearbyStaff.length,
      staff: nearbyStaff, // <-- frontend uses this key
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});
export default router;
