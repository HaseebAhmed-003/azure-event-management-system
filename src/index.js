require("dotenv").config();

const { loadSecretsFromKeyVault } = require("./lib/keyvault");
const { ensureIndexExists } = require("./lib/search"); // ← ADD THIS
const appInsights = require("applicationinsights");

const express = require("express");
const cors = require("cors");
const path = require("path");


const app = express();
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    console.log("🔑 Loading Azure Key Vault secrets...");

    // 1. LOAD KEY VAULT FIRST (CRITICAL)
    await loadSecretsFromKeyVault();

    // ← ADD THIS BLOCK right after the Key Vault call:
    console.log("🔍 Bootstrapping Azure AI Search index...");
    await ensureIndexExists();
    // ← END ADD

    // 2. BUILD DATABASE URL AFTER VAULT LOADS
    if (
      !process.env.DB_HOST ||
      !process.env.DB_USER ||
      !process.env.DB_NAME ||
      !process.env.DB_PASSWORD
    ) {
      throw new Error("Missing DB secrets after Key Vault load");
    }

    process.env.DATABASE_URL =
      `postgresql://${process.env.DB_USER}:` +
      `${encodeURIComponent(process.env.DB_PASSWORD)}` +
      `@${process.env.DB_HOST}:5432/${process.env.DB_NAME}?sslmode=require`;

    console.log("✅ DATABASE_URL READY");

    // Debug (safe)
    console.log("🔍 ENV CHECK:", {
      DB_HOST: process.env.DB_HOST,
      DB_USER: process.env.DB_USER,
      DB_NAME: process.env.DB_NAME,
      DATABASE_URL: "SET",
      JWT_SECRET: process.env.JWT_SECRET ? "SET" : "MISSING",
    });

    // 3. App Insights
    if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
      appInsights
        .setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING)
        .setAutoCollectRequests(true)
        .setAutoCollectExceptions(true)
        .setAutoCollectDependencies(true)
        .start();

      console.log("✅ App Insights enabled");
    }

    // 4. Middlewares
    app.use("/api/payments/webhook", express.raw({ type: "application/json" }));

    app.use(
      cors({
        origin: ["http://localhost:3001", "http://20.174.16.183:3001"],
        credentials: true,
      })
    );

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

    // 5. Routes — required AFTER vault so services load safely
      const authRoutes = require("./routes/auth.routes");
      const eventRoutes = require("./routes/event.routes");
      const bookingRoutes = require("./routes/booking.routes");
      const paymentRoutes = require("./routes/payment.routes");
      const ticketRoutes = require("./routes/ticket.routes");
      const attendanceRoutes = require("./routes/attendance.routes");

        app.use("/api/auth", authRoutes);
        app.use("/api/events", eventRoutes);
        app.use("/api/bookings", bookingRoutes);
        app.use("/api/payments", paymentRoutes);
        app.use("/api/tickets", ticketRoutes);
        app.use("/api/attendance", attendanceRoutes);

    // 6. Health
    app.get("/", (_req, res) => {
      res.json({ message: "EventHub API running 🚀" });
    });

    app.get("/health", (_req, res) => {
      res.json({ status: "ok" });
    });

    // 7. 404
    app.use((req, res) => {
      res.status(404).json({
        error: `Route ${req.method} ${req.path} not found`,
      });
    });

    // 8. Error handler
    app.use((err, _req, res, _next) => {
      console.error("❌ Server Error:", err);
      res.status(500).json({
        error: err.message || "Internal server error",
      });
    });

    // 9. Listen (IMPORTANT FIX)
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🔐 API → http://20.174.16.183:${PORT}/api`);
    });
  } catch (err) {
    console.error("❌ SERVER FAILED TO START:", err);
    process.exit(1);
  }
}

startServer();