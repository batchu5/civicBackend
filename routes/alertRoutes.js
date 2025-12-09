import express from "express";
import Alert from "../models/alert.js";
import { translateToHindi } from "../utils/constants.js";

const router = express.Router();
function pickLang(obj, lang) {
  if (!obj) return "";
  return obj[lang] || obj.en || "";
}

// ADMIN — CREATE ALERT
router.post("/create", async (req, res) => {
  try {
    const { title, message, department } = req.body;

    const title_hi = await translateToHindi(title);
    const message_hi = await translateToHindi(message);
    const department_hi = await translateToHindi(department);

    if (!title || !message || !department) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const alert = await Alert.create({
      title: { en: title, hi: title_hi },
      message: { en: message, hi: message_hi },
      department: { en: department, hi: department_hi },
    });

    res.status(201).json({ message: "Alert created", alert });
  } catch (err) {
    console.error("Create alert error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET ALL ALERTS
router.get("/all", async (req, res) => {
  try {
    const lang = req.query.lang || "en";
    const alerts = await Alert.find().sort({ createdAt: -1 });

    const formatted = alerts.map((a) => ({
      _id: a._id,
      title: pickLang(a.title, lang),
      message: pickLang(a.message, lang),
      department: pickLang(a.department, lang),
      createdAt: a.createdAt,
    }));

    res.json({ alerts: formatted });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch alerts" });
  }
});

export default router;
