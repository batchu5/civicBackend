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

// router.get("/tasks", protectStaff, async (req, res) => {
//   try {
//     const staffId = req.user._id;
//     console.log("/tasks is called");

//     const staff = await Staff.findById(staffId)
//       .populate({
//         path: "assignedIssues",
//         select: "description issueType locationDetails image status date",
//       });

//     if (!staff) {
//       return res.status(404).json({ message: "Staff not found" });
//     }

//     console.log("Assigned tasks:", staff.assignedIssues);

//     res.status(200).json({"tasks": staff.assignedIssues, "staffLocation": staff.geoLocation });
//   } catch (error) {
//     console.error("Error fetching tasks:", error);
//     res.status(500).json({ message: "Failed to fetch tasks" });
//   }
// });

router.get("/tasks", protectStaff, async (req, res) => {
  try {
    const staffId = req.user._id;

    const staff = await Staff.findById(staffId);
    if (!staff) {
      return res.status(404).json({ message: "Staff not found" });
    }

    const assignedIds = staff.assignedIssues;

    // Default: NEAREST tasks
    const tasks = await Issue.aggregate([
      {
        $geoNear: {
          near: {
            type: "Point",
            coordinates: staff.geoLocation.coordinates,
          },
          distanceField: "distance",
          spherical: true,
          query: { _id: { $in: assignedIds } }, 
        },
      },
      { $sort: { distance: 1 } }
    ]);

    res.status(200).json({
      tasks,
      staffLocation: staff.geoLocation,
    });

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

    console.log("departement", department);
    console.log("issyeId", issueId);
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
    });

    console.log("nearbyStaff",nearbyStaff);
    res.status(200).json({
      message:
        nearbyStaff.length > 0
          ? "Nearby staff members found"
          : "No nearby staff found within 5 km",
      count: nearbyStaff.length,
      staff: nearbyStaff
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});


router.get("/filter/:staffId", async (req, res) => {
  try {
    console.log("Inside the filter");

    const { staffId } = req.params;
    const { type } = req.query;

    const staff = await Staff.findById(staffId);
    if (!staff) return res.status(404).json({ message: "Staff not found" });

    const assignedIds = staff.assignedIssues;  // only these should be returned
    let issues = [];

    // 1️⃣ NEAREST OPTION
    if (type === "nearest") {
      issues = await Issue.aggregate([
        {
          $geoNear: {
            near: {
              type: "Point",
              coordinates: staff.geoLocation.coordinates,
            },
            distanceField: "distance",
            spherical: true,
            query: {
              _id: { $in: assignedIds }  // FILTER HERE
            },
          },
        },
        { $sort: { distance: 1 } },
      ]);

      return res.json({ success: true, issues });
    }

    // 2️⃣ PRIORITY OPTION (urgent → high → normal → low)
    if (type === "priority") {

      issues = await Issue.aggregate([
        {
          $match: { 
            _id: { $in: assignedIds }  // FILTER HERE
          }
        },
        {
          $addFields: {
            priorityWeight: {
              $switch: {
                branches: [
                  { case: { $eq: ["$priority.en", "urgent"] }, then: 4 },
                  { case: { $eq: ["$priority.en", "high"] }, then: 3 },
                  { case: { $eq: ["$priority.en", "normal"] }, then: 2 },
                  { case: { $eq: ["$priority.en", "low"] }, then: 1 },
                ],
                default: 0,
              },
            },
          },
        },
        { $sort: { priorityWeight: -1, date: -1 } },
      ]);

      return res.json({ success: true, issues });
    }

    return res.status(400).json({ message: "Invalid filter type" });

  } catch (err) {
    console.error("Filter Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


export default router;
