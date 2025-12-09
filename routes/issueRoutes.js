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
import { translateToHindi } from "../utils/constants.js";


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

router.post(
  "/",
  protect,
  upload.fields([{ name: "image" }]),
  async (req, res) => {
    try {
      console.log("inside upload");

      const { description, location, geoLocation, issueType } = req.body;
      const imageFile = req.files?.image?.[0];

      // Upload image
      const imageResult = await cloudinary.uploader.upload(imageFile.path, {
        folder: "complaints",
        format: "jpg"
      });

      console.log("Uploaded to Cloudinary");

      const parsedGeo = JSON.parse(geoLocation);
      const parsedLoc = JSON.parse(location);

      // ML classification
      const mlResult = await checkPriority(issueType, description);

      if (!mlResult) {
        mlResult.priority = "urgent";
      }

      // ---------------------------
      // 🌐 MULTILINGUAL TRANSLATION
      // ---------------------------
      const desc_hi = await translateToHindi(description);
      const type_hi = await translateToHindi(issueType);
      const priority_hi = await translateToHindi(mlResult.priority);
      const status_hi = await translateToHindi("pending");   // default

      // ---------------------------
      // Create multilingual issue
      // ---------------------------
      let issue = await Issue.create({
        user: req.user._id,

        description: { en: description, hi: desc_hi },
        issueType: { en: issueType, hi: type_hi },
        priority: { en: mlResult.priority, hi: priority_hi },
        status: { en: "pending", hi: status_hi },

        image: imageResult.secure_url,

        geoLocation: {
          type: "Point",
          coordinates: [
            Number(parsedGeo.coordinates[0]),
            Number(parsedGeo.coordinates[1])
          ]
        },

        locationDetails: parsedLoc
      });

      console.log("created multilingual issue");

      // FIND NEAREST STAFF
      const nearestStaff = await Staff.findOne({
        department: issueType,
        geoLocation: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [
                Number(parsedGeo.coordinates[0]),
                Number(parsedGeo.coordinates[1])
              ]
            },
            $maxDistance: 10000
          }
        }
      });

      // ASSIGN ISSUE
      if (nearestStaff) {
        issue.assignedTo = nearestStaff._id;

        // Update status multilingual
        issue.status.en = "assigned";
        issue.status.hi = await translateToHindi("assigned");
        await sendMail("New Issue Assigned bro", description, "Please checkout your app", nearestStaff.email);
        await issue.save();

        nearestStaff.assignedIssues.push(issue._id);
        await nearestStaff.save();
      }

      // SEND URGENT EMAIL
      if (issue.priority.en === "urgent") {
        const title = "Urgent issue has been recorded";
        const desc = `The issue ID ${issue._id}, which comes under ${issue.issueType.en} has been recorded as Urgent.`;
        const link = "https://x.com/home";
        await sendMail(title, desc, link, req.user.email);
      }

      // Return English priority for UI
      res.status(201).json({
        priority: issue.priority.en
      });

    } catch (err) {
      console.error("Issue creation error:", err);
      res.status(500).json({ message: err.message });
    }
  }
);


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
  console.log("inside nearby issues");
  try {
    const { lat, lng, mode, lang = "en" } = req.query;
    console.log("mode is", mode);

    if (!lat || !lng || !mode) {
      return res.status(400).json({ error: "lat, lng, mode required" });
    }

    const userLat = Number(lat);
    const userLng = Number(lng);

    const issues = await Issue.find({
      geoLocation: {
        $near: {
          $geometry: { type: "Point", coordinates: [userLng, userLat] },
          $maxDistance: 5000
        }
      }
    });

    let sortedIssues = issues;

    if (mode === "high") {
      const prioMap = { urgent: 4, high: 3, normal: 2, low: 1 };

      sortedIssues = issues.sort((a, b) => {
        return prioMap[b.priority.en] - prioMap[a.priority.en];
      });
    }

    if (mode === "low") {
      sortedIssues = issues.sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      );
    }

    // ------------------------------
    // 🔥 FORMAT DATA BASED ON lang
    // ------------------------------
    const formattedIssues = sortedIssues.map(issue => ({
      _id: issue._id,
      image: issue.image,
      date: issue.date,

      description: issue.description?.[lang] || issue.description.en,
      issueType: issue.issueType?.[lang] || issue.issueType.en,
      priority: issue.priority?.[lang] || issue.priority.en,
      status: issue.status?.[lang] || issue.status.en,

      likes: issue.likes,
      user: issue.user,
      assignedTo: issue.assignedTo,

      geoLocation: issue.geoLocation,
      locationDetails: issue.locationDetails
    }));
    
    console.log("formatedIssues", formattedIssues)
    res.json({
      count: formattedIssues.length,
      issues: formattedIssues
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

    console.log("reportId", reportId);
    console.log("staffId", staffId);

    if (!reportId || !staffId)
      return res.status(400).json({ message: "reportId and staffId are required" });

    const issue = await Issue.findById(reportId);
    if (!issue) return res.status(404).json({ message: "Issue not found" });

    const staff = await Staff.findById(staffId);
    if (!staff) return res.status(404).json({ message: "Staff not found" });

    issue.assignedTo = staff._id;
    issue.status.en = "assigned";
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

router.post("/assignAsCompleted/:issueId", async(req, res) => {
  try{
    console.log("Assign report as completed bruhh");

    const {issueId} = req.params;
    const issue = await Issue.findById(issueId);

    issue.status.en = "resolved";
    await issue.save();

    res.json({"completed": "ayipoledhu"});

  }catch (err) {
    console.error("Assign report error:", err);
    res.status(500).json({ message: "Failed to assign report" });
  }
})

router.get("/:id", async (req, res) => {
  try {
    const issueId = req.params.id;
    const issue = await Issue.findById(issueId)
      .populate("user", "name email") 
      .populate("assignedTo", "name email department");

    if (!issue) {
      return res.status(404).json({ message: "Issue not found" });
    }

    console.log("issue is", issue);
    res.status(200).json(issue);
  } catch (err) {
    console.error("Error fetching issue by ID:", err);
    if (err.kind === 'ObjectId') {
        return res.status(400).json({ message: "Invalid issue ID format" });
    }
    res.status(500).json({ message: "Server error while fetching issue" });
  }
});

export default router;