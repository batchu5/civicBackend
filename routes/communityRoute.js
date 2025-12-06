import express from "express";
import Community from "../models/community.js";
import User from "../models/User.js";

const router = express.Router();


router.post("/create", async (req, res) => {
  try {
    console.log("in create route")
    const { name, description, members } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Community name is required" });
    }

    const community = await Community.create({
      name,
      description: description || "",
      members: members || [],
    });

    res.status(201).json({
      message: "Community created successfully",
      community,
    });
  } catch (err) {
    console.error("Create community error:", err);
    res.status(500).json({ error: "Server error while creating community" });
  }
});

router.get("/allcom", async (req, res) => {
  try {
    const communities = await Community.find().sort({ createdAt: -1 });

    res.json({
      count: communities.length,
      communities,
    });
  } catch (err) {
    console.error("Get communities error:", err);
    res.status(500).json({ error: "Failed to fetch communities" });
  }
});

router.get("/all-users", async (req, res) => {
  try {
    console.log("Inside the all-users");
    const users = await User.find({}, "name phoneNumber email"); 

    res.json({ users });
  } catch (err) {
    console.log("Get users error:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.post("/add-members", async (req, res) => {
  try {
    const { communityId, members } = req.body;

    if (!communityId || !members) {
      return res.status(400).json({ error: "Missing fields" });
    }
    const usersExist = await User.find({ _id: { $in: members } });
    if (usersExist.length !== members.length) {
      return res.status(400).json({ error: "Some users do not exist" });
    }
    const updated = await Community.findByIdAndUpdate(
      communityId,
      { $addToSet: { members: { $each: members } } }, 
      { new: true }
    );

    res.json({
      message: "Members added successfully",
      community: updated
    });

  } catch (err) {
    console.log("Add members error:", err);
    res.status(500).json({ error: "Error adding members" });
  }
});

router.get("/:communityId/non-members", async (req, res) => {
  try {
    console.log("inside non-members");
    const { communityId } = req.params;

    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({ error: "Community not found" });
    }

    // Find users NOT already in members
    const users = await User.find(
      { _id: { $nin: community.members } },
      "name phoneNumber email"
    );

    res.json({ users });

  } catch (err) {
    console.error("Error fetching non-members:", err);
    res.status(500).json({ error: "Failed to fetch non-members" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log("inside community route");

    const community = await Community.findById(id);

    if (!community) {
      return res.status(404).json({ error: "Community not found" });
    }

    console.log("community", community);

    res.json({
      community
    });
  } catch (err) {
    console.error("Get community by ID error:", err);
    res.status(500).json({ error: "Failed to fetch community details" });
  }
});

router.get("/:id/check-member/:userId", async (req, res) => {
  try {
    const { id, userId } = req.params;

    const community = await Community.findById(id);

    if (!community) {
      return res.status(404).json({ error: "Community not found" });
    }

    const isMember = community.members.includes(userId);

    res.json({ isMember });
  } catch (err) {
    console.error("Check member error:", err);
    res.status(500).json({ error: "Server error" });
  }
});


export default router;
