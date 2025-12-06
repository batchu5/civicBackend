import express from "express";
import Message from "../models/Message.js";
const router = express.Router();

// GET COMMUNITY MESSAGES
router.get("/messages/:communityId", async (req, res) => {
  try {
    const msgs = await Message.find({ communityId: req.params.communityId })
      .sort({ timestamp: 1 });

    res.json({ messages: msgs });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
