import jwt from "jsonwebtoken";
import { ENV } from "../config/env.js";
import { db } from "../config/db.js";

/**
 * Extracts and decodes JWT token if present.
 * Does not block if no token is found.
 */
export async function optionalAuth(req, res, next) {
  try {
    const token =
      req.cookies?.ojaswi_token ||
      (req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.split(" ")[1]
        : null);

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, ENV.JWT_SECRET);

    if (decoded.role === "admin") {
      let admin = null;
      try {
        admin = await db.get("SELECT id, username, email, full_name, role FROM admin_users WHERE id = $1", [
          decoded.id
        ]);
      } catch (_) {}
      if (!admin) {
        admin = {
          id: decoded.id || 1,
          username: decoded.username || "admin",
          email: decoded.email || "admin@ojaswifoods.com",
          full_name: decoded.full_name || "Ojaswi Store Admin",
          role: "admin"
        };
      }
      req.user = admin;
    } else {
      let user = null;
      try {
        user = await db.get("SELECT id, phone, email, name, role FROM users WHERE id = $1", [
          decoded.id
        ]);
      } catch (err) {
        // Continue to Mongo fallback
      }

      if (!user) {
        try {
          const { User } = await import("../models/index.js");
          const mUser = await User.findOne({ id: decoded.id }).lean();
          if (mUser) {
            user = {
              id: mUser.id,
              phone: mUser.phone,
              email: mUser.email,
              name: mUser.name,
              role: mUser.role || "customer"
            };
          }
        } catch (mErr) {
          // Ignore
        }
      }

      req.user = user || null;
    }

    next();
  } catch (err) {
    req.user = null;
    next();
  }
}

/**
 * Middleware: Requires a logged-in customer or admin.
 */
export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: "Authentication required. Please log in."
    });
  }
  next();
}

/**
 * Middleware: Strictly requires role === 'admin'.
 */
export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      error: "Access denied. Administrator privileges required."
    });
  }
  next();
}

/**
 * Helper to generate signed JWT token for user/admin
 */
export function generateToken(payload, expiresIn = "30d") {
  return jwt.sign(payload, ENV.JWT_SECRET, { expiresIn });
}

/**
 * Sets secure HttpOnly session cookie on response (Session-only: automatically cleared on browser close)
 */
export function setAuthCookie(res, token) {
  const isProduction = ENV.NODE_ENV === "production";
  res.cookie("ojaswi_token", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/"
    // Session cookie: no persistent maxAge so closing the browser destroys it
  });
}

/**
 * Clears authentication cookie
 */
export function clearAuthCookie(res) {
  const isProduction = ENV.NODE_ENV === "production";
  res.clearCookie("ojaswi_token", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/"
  });
}
