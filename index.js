// import express from "express";
// import dotenv from "dotenv";
// import connectDB from "./config/db.js";
// import cors from "cors";

// dotenv.config();
// connectDB();

// const app = express();
// app.use(cors());
// app.use(express.json());

// import authRoutes from "./routes/authRoutes.js";
// import issueRoutes from "./routes/issueRoutes.js";
// import StaffRoutes from "./routes/StaffRoutes.js";
// import adminRoutes from "./routes/adminRoute.js"

// app.use("/auth", authRoutes);
// app.use("/issues", issueRoutes);
// app.use("/staff", StaffRoutes);
// app.use("/admin", adminRoutes);

// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import cors from "cors";
import http from "http";          // << REQUIRED
import { WebSocketServer } from "ws";   // << REQUIRED

dotenv.config();
connectDB();

const app = express();
app.use(cors());
app.use(express.json());

// ----------------------------
// EXISTING ROUTES
// ----------------------------
import authRoutes from "./routes/authRoutes.js";
import issueRoutes from "./routes/issueRoutes.js";
import StaffRoutes from "./routes/StaffRoutes.js";
import adminRoutes from "./routes/adminRoute.js";
import chatRoutes from "./routes/chatRoutes.js";
import communityRoute from "./routes/communityRoute.js"
import Message from "./models/Message.js";
import alertRoutes from "./routes/alertRoutes.js";

app.use("/alerts", alertRoutes);
app.use("/community", communityRoute);
app.use("/chat", chatRoutes);
app.use("/auth", authRoutes);
app.use("/issues", issueRoutes);
app.use("/staff", StaffRoutes);
app.use("/admin", adminRoutes);

// ----------------------------
// CREATE REAL HTTP SERVER (REQUIRED FOR WS)
// ----------------------------
const server = http.createServer(app);

// ----------------------------
// START WEBSOCKET SERVER
// ----------------------------
const wss = new WebSocketServer({ server, path: "/ws/chat" });

// Rooms: { communityId: Set<WebSocket> }
const rooms = {};

function joinRoom(ws, communityId) {
  if (!rooms[communityId]) rooms[communityId] = new Set();
  rooms[communityId].add(ws);
  ws.communityId = communityId;
}

function leaveRoom(ws) {
  const room = rooms[ws.communityId];
  if (room) {
    room.delete(ws);
    if (room.size === 0) delete rooms[ws.communityId];
  }
}

// ----------------------------
// WS CONNECTION HANDLER
// ----------------------------
wss.on("connection", (ws, req) => {
  console.log("New WebSocket connection");

  const params = new URLSearchParams(req.url.split("?")[1]);
  const communityId = params.get("community");

  if (!communityId) {
    console.log("No communityId provided - closing WS");
    ws.close();
    return;
  }

  joinRoom(ws, communityId);

  ws.on("message", async (msg) => {
  try {
    const data = JSON.parse(msg);

    if (data.type === "chat") {
      // Save message in DB
      const savedMsg = await Message.create({
        communityId,
        text: data.payload.text,
        sender: data.payload.sender,
        timestamp: data.payload.timestamp,
      });

      const payload = {
        type: "chat",
        payload: savedMsg,
      };

      // Broadcast to everyone in room
      rooms[communityId].forEach((client) => {
        if (client.readyState === 1) {
          client.send(JSON.stringify(payload));
        }
      });
    }
  } catch (err) {
    console.log("WS error:", err);
  }
});


  ws.on("close", () => {
    console.log("WS closed");
    leaveRoom(ws);
  });
});

// ----------------------------
// START SERVER (HTTP + WS)
// ----------------------------
const PORT = process.env.PORT || 3000;

server.listen(PORT, () =>
  console.log(`Server running on port ${PORT} (HTTP + WS enabled)`)
);
