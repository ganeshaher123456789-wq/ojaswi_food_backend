import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { ENV } from "./config/env.js";
import { db } from "./config/db.js";
import { seedDatabase } from "./database/seed.js";
import { optionalAuth } from "./middleware/auth.js";
import { errorHandler } from "./middleware/errorHandler.js";

import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import accountRoutes from "./routes/accountRoutes.js";
import contactRoutes from "./routes/contactRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import { connectMongo, getMongoStatus } from "./config/mongodb.js";
import { syncMongoAtlas } from "./services/mongoSyncService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Trust proxy on cloud hosts like Render to ensure correct secure cookie & IP handling
app.set("trust proxy", 1);

// CORS Configuration for Local Development & Production Vercel Deployments
const defaultAllowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5000",
  "http://localhost:5173",
  "http://localhost:5500",
  "http://localhost:8080",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5500",
  "http://127.0.0.1:8080"
];

if (ENV.FRONTEND_URL) {
  defaultAllowedOrigins.push(ENV.FRONTEND_URL.replace(/\/+$/, ""));
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without Origin header (curl, mobile apps, server-to-server) or file:// origin 'null'
      if (!origin || origin === "null") return callback(null, true);

      const normalizedOrigin = origin.replace(/\/+$/, "");

      // In production, enforce origin whitelisting
      if (ENV.NODE_ENV === "production") {
        if (
          defaultAllowedOrigins.includes(normalizedOrigin) ||
          normalizedOrigin.endsWith(".vercel.app") ||
          (ENV.FRONTEND_URL && normalizedOrigin.startsWith(ENV.FRONTEND_URL.replace(/\/+$/, "")))
        ) {
          return callback(null, true);
        }
        return callback(new Error(`CORS policy: Origin ${origin} is not allowed.`));
      }

      // In development, allow localhost and configured origins
      return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Basic Security Headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

// Authentication context for all requests
app.use(optionalAuth);

// Static Assets (Served from backend/images or sibling frontend/ if present)
const frontendPath = path.resolve(__dirname, "../frontend");
const frontendImages = path.resolve(frontendPath, "images");
const backendImages = path.resolve(__dirname, "images");

if (fs.existsSync(backendImages)) {
  app.use("/images", express.static(backendImages));
}
if (fs.existsSync(frontendImages)) {
  app.use("/images", express.static(frontendImages));
}

// Serve frontend static files when frontend directory is present
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
  const frontendPublic = path.resolve(frontendPath, "public");
  if (fs.existsSync(frontendPublic)) {
    app.use(express.static(frontendPublic));
  }
}

// REST API Routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/reviews", reviewRoutes);

// Health Check API (Available at both /health and /api/health for Render Web Service)
async function handleHealthCheck(req, res) {
  try {
    const dbHealth = await db.checkHealth();
    const mongoStatus = getMongoStatus();
    const isHealthy = dbHealth.healthy !== false || mongoStatus.connected;

    const payload = {
      status: isHealthy ? "ok" : "degraded",
      app: "Ojaswi Foods E-Commerce API",
      environment: ENV.NODE_ENV,
      database: mongoStatus.connected ? "MongoDB Atlas" : dbHealth.type,
      databaseConnected: isHealthy,
      mongoAtlas: {
        connected: mongoStatus.connected,
        database: mongoStatus.database || "ojaswi",
        host: mongoStatus.host || "Atlas Cluster"
      },
      time: new Date().toISOString()
    };

    if (!isHealthy) {
      return res.status(503).json({
        ...payload,
        error: "Database connection unavailable."
      });
    }

    res.status(200).json(payload);
  } catch (err) {
    res.status(503).json({
      status: "error",
      app: "Ojaswi Foods E-Commerce API",
      error: "Health check error",
      time: new Date().toISOString()
    });
  }
}

app.get("/health", handleHealthCheck);
app.get("/api/health", handleHealthCheck);

// Clean Frontend URL Rewrites (when monolithic fallback is active)
const sendPage = (pageName) => (req, res) => {
  const p1 = path.resolve(frontendPath, pageName);
  const p2 = path.resolve(frontendPath, "public", pageName);
  if (fs.existsSync(p1)) return res.sendFile(p1);
  if (fs.existsSync(p2)) return res.sendFile(p2);
  res.sendFile(p1);
};

app.get("/", sendPage("index.html"));
app.get("/index.html", sendPage("index.html"));
app.get("/index3.html", sendPage("index.html"));
app.get("/login", sendPage("login.html"));
app.get("/register", sendPage("login.html"));
app.get("/verify-otp", sendPage("login.html"));
app.get("/account", sendPage("account.html"));
app.get("/orders", sendPage("orders.html"));
app.get("/checkout", sendPage("checkout.html"));
app.get("/order-confirmation", sendPage("order-confirmation.html"));

// Legacy admin routes redirect to customer login
app.get(["/admin", "/admin/*"], (req, res) => res.redirect(301, "/login"));

// Legal & Info pages
app.get("/privacy-policy", sendPage("privacy-policy.html"));
app.get("/terms-and-conditions", sendPage("terms-and-conditions.html"));
app.get("/refund-policy", sendPage("refund-policy.html"));
app.get("/shipping-policy", sendPage("shipping-policy.html"));
app.get("/cancellation-policy", sendPage("cancellation-policy.html"));
app.get("/contact-us", sendPage("contact-us.html"));

// Central Error Handler
app.use(errorHandler);

// Start Server - Binds to 0.0.0.0 for Render cloud hosting
async function startServer() {
  try {
    await seedDatabase();

    // Connect to MongoDB Atlas and synchronize collections
    try {
      await connectMongo();
      await syncMongoAtlas();
    } catch (mongoErr) {
      console.warn("[MongoDB] Startup sync notice:", mongoErr.message);
    }

    const host = process.env.NODE_ENV === "production" ? "0.0.0.0" : undefined;
    const mongoStatus = getMongoStatus();
    const serverCallback = () => {
      console.log("==================================================");
      console.log(`[OK] OJASWI PREMIUM E-COMMERCE SERVER RUNNING`);
      console.log(`>> Host Binding: ${host || "localhost"}:${ENV.PORT}`);
      console.log(`>> Environment:  ${ENV.NODE_ENV}`);
      console.log(`>> Health Check: http://localhost:${ENV.PORT}/health`);
      console.log(`>> Database:     ${mongoStatus.connected ? "MongoDB Atlas (" + (mongoStatus.database || "ojaswi") + ")" : db.isMongo ? "MongoDB Atlas" : db.isPostgres ? "PostgreSQL" : "SQLite Embedded"}`);
      console.log("==================================================");
    };

    if (host) {
      app.listen(ENV.PORT, host, serverCallback);
    } else {
      app.listen(ENV.PORT, serverCallback);
    }
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

export { startServer };

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  startServer();
}

export default app;
