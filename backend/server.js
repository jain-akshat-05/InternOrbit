require("dotenv").config();
const config = require("./config/env").loadConfig();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const connectDB = require("./config/db");
const createSocketAuth = require("./middleware/socketAuth");

const authRoutes = require("./routes/authRoutes");
const internshipRoutes = require("./routes/internshipRoutes");
const applicationRoutes = require("./routes/applicationRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();
app.use(cors({ origin: config.clientUrl }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: config.clientUrl },
});

io.use(createSocketAuth(config.jwtSecret));

io.on("connection", (socket) => {
  socket.join(`user:${socket.data.userId}`);
});

// make io accessible inside route handlers via req.app.get("io")
app.set("io", io);

app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/api/internships", internshipRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/admin", adminRoutes);

// basic error handler
app.use((err, req, res, next) => {
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON request body" });
  }
  console.error("Unhandled request error", { name: err?.name || "Error" });
  res.status(500).json({ message: "Internal server error" });
});

const startServer = async () => {
  try {
    await connectDB(config.mongoUri);
    server.listen(config.port, () =>
      console.log(`InternOrbit backend running on port ${config.port}`)
    );
  } catch {
    console.error("Unable to connect to MongoDB; verify MONGO_URI and database availability.");
    process.exitCode = 1;
  }
};

startServer();
