import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import admin from "../models/admin.js";
const router = express.Router();


router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log("gonna login");
    const user = await admin.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1d" });

    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/signup", async (req, res) => {
  try {
    const { email, password } = req.body;

    const existingUser = await admin.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "admin already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new admin({ email, password: hashedPassword });
    await newUser.save();

    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, { expiresIn: "1d" });

    res.status(201).json({ message: "Signup successful", token });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: error.message });
  }
});




export default router;
