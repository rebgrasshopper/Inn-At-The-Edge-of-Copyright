import cors from "cors";
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import path from "path";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import { authRouter, charactersRouter } from "./routes/index.js";
import * as CorpseService from "./services/CorpseService.js";
import { getSocketRoomName } from "./socket/handlers.js";
import { registerHandlers, socketAuthMiddleware } from "./socket/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// Socket.io setup
const io = new Server(httpServer, {
  cors: {
    origin:
      process.env.NODE_ENV === "production"
        ? false
        : (origin, callback) => {
            // Allow localhost, local network IPs, and ngrok URLs
            const allowed =
              !origin ||
              origin.includes("localhost") ||
              origin.includes("127.0.0.1") ||
              origin.match(/^https?:\/\/192\.168\.\d+\.\d+/) ||
              origin.match(/^https?:\/\/10\.\d+\.\d+\.\d+/) ||
              origin.includes(".ngrok-free.app") ||
              origin.includes(".ngrok.io");
            callback(null, allowed);
          },
    methods: ["GET", "POST"],
  },
});

// Socket.io authentication middleware
io.use(socketAuthMiddleware);

// Middleware
app.use(cors());
app.use(express.json());

// API routes
app.use("/api/auth", authRouter);
app.use("/api/characters", charactersRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Serve static files in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../client/dist")));
  // Express 5 requires named wildcard parameter
  app.get("/{*splat}", (_req, res) => {
    res.sendFile(path.join(__dirname, "../client/dist/index.html"));
  });
}

// Socket.io connection handling
io.on("connection", (socket) => {
  registerHandlers(io, socket);
});

const PORT = process.env.PORT || 3000;

// Corpse cleanup interval (every 5 minutes)
const CORPSE_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

setInterval(async () => {
  try {
    const expiredCorpses = await CorpseService.cleanupExpiredCorpses();
    for (const corpse of expiredCorpses) {
      io.to(getSocketRoomName(corpse.roomId)).emit("chat:message", {
        id: crypto.randomUUID(),
        type: "system",
        content: `The corpse of ${corpse.playerName} crumbles into dust and fades away.`,
        timestamp: new Date().toISOString(),
      });
    }
    if (expiredCorpses.length > 0) {
      console.log(`Cleaned up ${expiredCorpses.length} expired corpse(s)`);
    }
  } catch (error) {
    console.error("Error cleaning up expired corpses:", error);
  }
}, CORPSE_CLEANUP_INTERVAL_MS);

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

export { app, httpServer, io };
