

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes       = require("./routes/auth.routes");
const eventRoutes      = require("./routes/event.routes");
const bookingRoutes    = require("./routes/booking.routes");
const paymentRoutes    = require("./routes/payment.routes");
const ticketRoutes     = require("./routes/ticket.routes");
const attendanceRoutes = require("./routes/attendance.routes");

const app  = express();
const PORT = process.env.PORT || 3000;

app.use("/api/payments/webhook", express.raw({ type: "application/json" }));

app.use(cors({
  origin: [
    "http://20.174.16.183:3001",
    "http://localhost:3001"
  ],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadDir = process.env.UPLOAD_DIR || "uploads";
app.use("/uploads", express.static(path.join(process.cwd(), uploadDir)));

app.use("/api/auth",       authRoutes);
app.use("/api/events",     eventRoutes);
app.use("/api/bookings",   bookingRoutes);
app.use("/api/payments",   paymentRoutes);
app.use("/api/tickets",    ticketRoutes);
app.use("/api/attendance", attendanceRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "Event Management & QR Attendance System API",
    version: "1.0.0",
    status: "running",
    endpoints: {
      auth:       "/api/auth",
      events:     "/api/events",
      bookings:   "/api/bookings",
      payments:   "/api/payments",
      tickets:    "/api/tickets",
      attendance: "/api/attendance",
    },
  });
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`   Auth API  → http://localhost:${PORT}/api/auth`);
  console.log(`   Health    → http://localhost:${PORT}/health\n`);
});

module.exports = app;