import express from "express";
import Alert from "../models/alert.js";

const router = express.Router();

// ADMIN — CREATE ALERT
router.post("/create", async (req, res) => {
  try {
    const { title, message, department } = req.body;

    if (!title || !message || !department) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const alert = await Alert.create({ title, message, department });

    res.status(201).json({ message: "Alert created", alert });
  } catch (err) {
    console.error("Create alert error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET ALL ALERTS
router.get("/all", async (req, res) => {
  try {
    const alerts = await Alert.find().sort({ createdAt: -1 });
    res.json({ alerts });
  } catch (err) {
    console.error("Fetch alerts error:", err);
    res.status(500).json({ error: "Failed to fetch alerts" });
  }
});

export default router;
