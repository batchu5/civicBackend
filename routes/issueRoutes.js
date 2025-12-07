import express from "express";
import Issue from "../models/Issue.js";
import Staff from "../models/Staff.js";
const router = express.Router();
import multer from "multer";
import cloudinary from "../config/cloudinary.js";
import protect from "../middleware/authMiddleware.js";
import pkg from "expo-server-sdk";
import { classifyIssue } from "../MLmodel.js";
import sendMail from "../functions/mail.js";


const upload = multer({ dest: "uploads/" }); 

async function checkPriority(category, description) {
  try {
    
    if (!category || !description) return res.status(400).json({ error: "category & description required" });

    const mlResult = await classifyIssue(category, description);

    if (mlResult.priority === "urgent") {
      console.log("Trigger URGENT notifications for staff/admin");
    }

    return mlResult;
  } catch (err) {
    console.error("Error in /report:", err);
  }
};

router.post("/",protect, upload.fields([ {name: "image"}]), async (req, res) => {
  try {

    console.log("inside upload")
    const { description, location, geoLocation, issueType } = req.body;
    const imageFile = req.files?.image?.[0];  

    const imageResult = await cloudinary.uploader.upload(imageFile.path, {
        folder: "complaints",
        format: "jpg",
    });


    console.log("Uploaded to Cloudinary");
    const parsedGeo = JSON.parse(geoLocation);
    const parsedLoc = JSON.parse(location);
    const mlResult = await checkPriority(issueType, description);

    console.log("ml result - priority", mlResult);
    
    if(!mlResult){
      mlResult.priority = "urgent";
      console.log("ml result is null here");
      return;
    }

    let issue = await Issue.create({
      user: req.user._id,
      description,
      image: imageResult.secure_url,
      priority:  mlResult.priority,
      issueType,
      geoLocation: {
        type: "Point",
        coordinates: [
          Number(parsedGeo.coordinates[0]),
          Number(parsedGeo.coordinates[1]),
        ],
      },
      locationDetails: parsedLoc,
    });

    console.log("created the issue");
    
    const nearestStaff = await Staff.findOne({
      department: issueType,
      geoLocation: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [
              Number(parsedGeo.coordinates[0]),
              Number(parsedGeo.coordinates[1]),
            ],
          },
          $maxDistance: 10000, 
        },
      },
    });
    
    console.log("nearestStaff", nearestStaff);

    if (nearestStaff) {
      console.log("Nearest Staff is found");
      issue.assignedTo = nearestStaff._id;
      issue.status = "assigned";
      await issue.save();

      nearestStaff.assignedIssues.push(issue._id);
      await nearestStaff.save();
    }

    if(issue.priority === "urgent"){
      const title = "urgent issue has been fixed";
      const description = `The issue ID ${issue._id}, which comes under ${issue.issueType} has been recorded as Urgent, please look into matter through your dashboard`;
      const link = "https://x.com/home"
      await sendMail(title,description, link, req.user.email );
    }

    res.status(201).json({
      "priority": issue.priority,
    });
  } catch (err) {
    console.error("Issue creation error:", err);
    res.status(500).json({ message: err.message });
  }
});

router.post("/check-duplicate", protect, async (req, res) => {
  try {
    const { geoLocation, issueType } = req.body;
    const parsedGeo = JSON.parse(geoLocation);

    console.log("Inside the check-duplicate")

    const existingIssue = await Issue.findOne({
      issueType,
      geoLocation: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [
              Number(parsedGeo.coordinates[0]),
              Number(parsedGeo.coordinates[1])
            ],
          },
          $maxDistance: 3, 
        },
      },
    }).populate("user", "name email");

    if (existingIssue) {

      console.log("issue exists", existingIssue);

      return res.json({
        exists: true,
        issue: existingIssue,
      });
    } else {
      console.log("Issue not exists");
      return res.json({ exists: false });
    }
  } catch (error) {
    console.error("Duplicate check error:", error);
    res.status(500).json({ message: "Server error checking duplicate issue" });
  }
});

router.get("/nearby", async (req, res) => {
  try {
    const { lat, lng, mode } = req.query;

    if (!lat || !lng || !mode) {
      return res.status(400).json({ error: "lat, lng, mode required" });
    }

    const userLat = Number(lat);
    const userLng = Number(lng);

    // Query issues within 5 KM (5000 meters)
    const issues = await Issue.find({
      geoLocation: {
        $near: {
          $geometry: { type: "Point", coordinates: [userLng, userLat] },
          $maxDistance: 5000, // 5km
        },
      },
    });

    let sortedIssues = issues;

    // High Priority FIRST
    if (mode === "high") {
      sortedIssues = issues.sort((a, b) => {
        const prioMap = { high: 3, medium: 2, low: 1 };
        return prioMap[b.priority] - prioMap[a.priority];
      });
    }

    // Recent FIRST
    if (mode === "recent") {
      sortedIssues = issues.sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      );
    }

    res.json({
      count: sortedIssues.length,
      issues: sortedIssues,
    });
  } catch (err) {
    console.error("Nearby issues error:", err);
    res.status(500).json({ error: "Failed to fetch nearby issues" });
  }
});



router.post("/:id/like", protect, async (req, res) => {
  try {
    const issue = await Issue.findById(req.params.id);

    if (!issue) return res.status(404).json({ message: "Issue not found" });

    const userId = req.user._id;
    const alreadyLiked = issue.likes.includes(userId);

    if (alreadyLiked) {
      issue.likes.pull(userId);
    } else {
      // Add like
      issue.likes.push(userId);
    }

    await issue.save();
    
    res.json({ 
      likes: issue.likes, 
      likesCount: issue.likes.length 
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/:id/unlike", protect, async (req, res) => {
  try {
    const issue = await Issue.findById(req.params.id);

    if (!issue) return res.status(404).json({ message: "Issue not found" });

    const userId = req.user._id;
    
    issue.likes.pull(userId);
    await issue.save();
    
    res.json({ 
      likes: issue.likes, 
      likesCount: issue.likes.length 
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


router.get("/my", protect, async (req, res) => {
  try {
    const issues = await Issue.find({ user: req.user }).sort({ date: -1 });
    res.json(issues);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});




router.get("/bbox", async (req, res) => {
  try {
    console.log("bbox enpoint called");
    const { bbox } = req.query;
    if (!bbox) return res.status(400).json({ message: "Bounding box required" });

    const [minLng, minLat, maxLng, maxLat] = bbox.split(",").map(Number);

    const issues = await Issue.find({
      "geoLocation.coordinates.0": { $gte: minLng, $lte: maxLng },
      "geoLocation.coordinates.1": { $gte: minLat, $lte: maxLat },
    });

    res.status(200).json({ reports: issues });
  } catch (err) {
    console.error("Error fetching issues in bbox:", err);
    res.status(500).json({ message: "Failed to fetch issues" });
  }
});

router.post("/assign", async (req, res) => {
  try {
    console.log("Assign report endpoint called");
    const { reportId, staffId } = req.body;

    if (!reportId || !staffId)
      return res.status(400).json({ message: "reportId and staffId are required" });

    const issue = await Issue.findById(reportId);
    if (!issue) return res.status(404).json({ message: "Issue not found" });

    const staff = await Staff.findById(staffId);
    if (!staff) return res.status(404).json({ message: "Staff not found" });

    issue.assignedTo = staff._id;
    issue.status = "assigned";
    await issue.save();

    if (!staff.assignedIssues.includes(issue._id)) {
      staff.assignedIssues.push(issue._id);
      await staff.save();
    }
    res.status(200).json({ message: `Issue assigned to ${staff.email}`, issue });
  } catch (err) {
    console.error("Assign report error:", err);
    res.status(500).json({ message: "Failed to assign report" });
  }
});

export default router;