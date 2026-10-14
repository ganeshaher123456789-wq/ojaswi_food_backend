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
      const admin = await db.get("SELECT id, username, email, full_name, role FROM admin_users WHERE id = $1", [
        decoded.id
      ]);
      req.user = admin || null;
    } else {
      const user = await db.get("SELECT id, phone, email, name, role FROM users WHERE id = $1", [
        decoded.id
      ]);
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
 * Sets secure HttpOnly cookie on response
 */
export function setAuthCookie(res, token) {
  const isProduction = ENV.NODE_ENV === "production";
  res.cookie("ojaswi_token", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
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
    sameSite: isProduction ? "none" : "lax"
  });
}
