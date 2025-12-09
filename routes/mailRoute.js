import express from "express";
import multer from "multer";
import nodemailer from "nodemailer";
import path from "path";
import fs from "fs";

const router = express.Router();

// --- Multer setup (store the image temporarily) ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "./uploads";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// --- SEND MAIL ROUTE ---
router.post("/sendMail/:taskId", upload.single("image"), async (req, res) => {
  try {

    console.log("got the details will send the mail npw");
    const { taskId } = req.params;
    const { title, description } = req.body;

    if (!title || !description) {
      return res.status(400).json({ message: "Missing fields" });
    }

    // Prepare the email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.MY_EMAIL,
        pass: process.env.MY_EMAIL_PASS,
      },
    });

    // Blue clickable link
    const taskURL = `http://localhost:5173/issuedetailes/${taskId}`;

    const htmlContent = `
      <div style="font-family: Arial; padding: 10px;">
        <h2>${title}</h2>
        <p>${description}</p>

        ${
          req.file
            ? `<p><strong>Attached Image:</strong></p>
              <img src="cid:task-image" style="max-width: 300px; border-radius: 5px;" />`
            : ""
        }

        <p style="margin-top: 20px;">
          <a href="${taskURL}" 
             style="color: #1a73e8; font-size: 16px; text-decoration: underline;">
            Click here
          </a> to view the task details.
        </p>

      </div>
    `;

    // Attach image if provided
    const mailOptions = {
      from: process.env.MY_EMAIL,
      to: "mmviki957@gmail.com", 
      subject: `Task Update: ${title}`,
      html: htmlContent,
      attachments: req.file
        ? [
            {
              filename: req.file.filename,
              path: req.file.path,
              cid: "task-image", 
            },
          ]
        : [],
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: "Mail sent successfully" });
  } catch (error) {
    console.error("Mail error:", error);
    res.status(500).json({ message: "Failed to send mail" });
  }
});

export default router;
