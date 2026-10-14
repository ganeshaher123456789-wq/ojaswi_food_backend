import mongoose from "mongoose";
import { ENV } from "./env.js";

let isConnecting = false;

export async function connectMongo() {
  if (!ENV.MONGODB_URI) {
    return {
      connected: false,
      configured: false,
      message: "MONGODB_URI not configured. Using embedded database."
    };
  }

  // Already connected or connecting
  if (mongoose.connection.readyState === 1) {
    return { connected: true, configured: true };
  }
  if (isConnecting) {
    return { connected: false, configured: true, pending: true };
  }

  isConnecting = true;

  try {
    // Sanitize connection URI for log display (never expose credentials)
    const sanitizedUri = ENV.MONGODB_URI.replace(/:([^:@]+)@/, ":****@");
    console.log(`[MongoDB] Connecting to MongoDB Atlas (${sanitizedUri})...`);

    mongoose.connection.on("connected", () => {
      console.log("[MongoDB] Connection established successfully to MongoDB Atlas.");
    });

    mongoose.connection.on("error", (err) => {
      console.error("[MongoDB] Connection error:", err.message);
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("[MongoDB] Disconnected from MongoDB Atlas.");
    });

    await mongoose.connect(ENV.MONGODB_URI, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4 // IPv4 preference
    });

    isConnecting = false;
    return { connected: true, configured: true };
  } catch (err) {
    isConnecting = false;
    console.error("[MongoDB] Failed to connect to MongoDB Atlas:", err.message);
    return { connected: false, configured: true, error: err.message };
  }
}

export function getMongoStatus() {
  const stateMap = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting"
  };
  const state = mongoose.connection.readyState;
  return {
    configured: Boolean(ENV.MONGODB_URI),
    state: stateMap[state] || "unknown",
    connected: state === 1
  };
}

export default { connectMongo, getMongoStatus };
