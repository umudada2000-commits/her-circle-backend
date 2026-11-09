import dns from "dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);
import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";

import authRouter from "./routes/auth.js";
import ticketsRouter from "./routes/tickets.js";
import profileRouter from "./routes/profile.js";
import adminRouter from "./routes/admin.js";
import eventsRouter from "./routes/events.js";

const app = express();

// Middlewares
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(express.json());

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use("/api/auth", authRouter);
app.use("/api/tickets", ticketsRouter);
app.use("/api/profile", profileRouter);
app.use("/api/admin", adminRouter);
app.use("/api/events", eventsRouter);

// Global error handler (Express 5 style)
app.use((err, req, res, next) => {
  console.error("Global error handler caught an error:", err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    message: err.message || "Internal server error",
  });
});

// MongoDB connection and server startup
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

const startServer = async () => {
  try {
    if (!mongoUri) {
      throw new Error("MONGODB_URI or MONGO_URI is not defined");
    }
    await mongoose.connect(mongoUri);
    console.log("MongoDB connected");

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

startServer();

export default app;

