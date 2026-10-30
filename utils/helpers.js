import crypto from "crypto";

/**
 * Validates and normalizes an Indian phone number.
 * Accepts formats: 7972483489, +917972483489, 07972483489, +91-7972483489
 * Returns 10-digit string or null if invalid.
 */
export function validateIndianPhone(input) {
  if (input === null || input === undefined) return null;
  const str = String(input).trim();
  if (!str) return null;

  // Remove spaces, hyphens, parentheses, dots
  let cleaned = str.replace(/[\s\-\(\)\.]/g, "");

  // Remove leading +91 or 91 or 0
  if (cleaned.startsWith("+91")) cleaned = cleaned.slice(3);
  else if (cleaned.startsWith("91") && cleaned.length === 12) cleaned = cleaned.slice(2);
  else if (cleaned.startsWith("0") && cleaned.length === 11) cleaned = cleaned.slice(1);

  // Accept any valid 10-digit mobile number
  if (/^\d{10}$/.test(cleaned)) {
    return cleaned;
  }
  return null;
}

/**
 * Validates Indian 6-digit PIN code.
 */
export function validateIndianPincode(input) {
  if (!input || typeof input !== "string") return false;
  const cleaned = input.trim();
  return /^[1-9][0-9]{5}$/.test(cleaned);
}

/**
 * Validates standard email address.
 */
export function validateEmail(input) {
  if (!input || typeof input !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.trim().toLowerCase());
}

/**
 * Generates an official Ojaswi Order ID.
 * Format: #OJ followed by 6 alphanumeric hex characters (e.g., #OJ79A2B4)
 */
export function generateOrderId() {
  const hex = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `#OJ${hex}`;
}

/**
 * Sanitizes input strings against basic XSS.
 */
export function sanitize(str) {
  if (typeof str !== "string") return str;
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Formats a currency amount into Indian Rupee string (e.g. ₹1,499.00)
 */
export function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return `₹${num.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
