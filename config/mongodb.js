import mongoose from "mongoose";
import { ENV } from "./env.js";

let connectPromise = null;

export async function connectMongo() {
  if (!ENV.MONGODB_URI) {
    return {
      connected: false,
      configured: false,
      message: "MONGODB_URI not configured. Using embedded database."
    };
  }

  // Already connected
  if (mongoose.connection.readyState === 1) {
    return { connected: true, configured: true };
  }

  // If a connection attempt is already in flight, reuse the promise
  if (connectPromise) {
    return connectPromise;
  }

  connectPromise = (async () => {
    try {
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
        dbName: process.env.MONGODB_DB_NAME || "ojaswi",
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 8000,
        socketTimeoutMS: 45000,
        family: 4 // IPv4 preference
      });

      return { connected: true, configured: true };
    } catch (err) {
      console.error("[MongoDB] Failed to connect to MongoDB Atlas:", err.message);
      return { connected: false, configured: true, error: err.message };
    } finally {
      connectPromise = null;
    }
  })();

  return connectPromise;
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
    connected: state === 1,
    database: state === 1 ? mongoose.connection.name : null
  };
}

export default { connectMongo, getMongoStatus };
