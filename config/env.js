import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file from backend directory or project root
const envCandidates = [
  path.resolve(__dirname, "../.env"),
  path.resolve(__dirname, "../../.env"),
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "backend/.env")
];

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT || "5000", 10),
  
  // Database Configuration
  MONGODB_URI: process.env.MONGODB_URI || "",
  MONGODB_DB_NAME: process.env.MONGODB_DB_NAME || "ojaswi",
  DATABASE_URL: process.env.DATABASE_URL || "",

  // Frontend URL (for CORS and redirects)
  FRONTEND_URL: process.env.FRONTEND_URL || "",
  
  // Google OAuth Client ID
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",

  // Secrets
  JWT_SECRET: process.env.JWT_SECRET || "ojaswi-super-secret-jwt-key-2026-production-ready",
  SESSION_SECRET: process.env.SESSION_SECRET || "ojaswi-session-secret-salt-malegaon",
  
  // Admin Credentials
  ADMIN_DEFAULT_USER: process.env.ADMIN_DEFAULT_USER || "admin",
  ADMIN_DEFAULT_PASSWORD: process.env.ADMIN_DEFAULT_PASSWORD || "OjaswiAdmin@2026",
  ADMIN_DEFAULT_EMAIL: process.env.ADMIN_DEFAULT_EMAIL || "admin@ojaswifoods.com",
  
  // SMS Notification
  SMS_PROVIDER: process.env.SMS_PROVIDER || "console", // 'fast2sms' | 'twilio' | 'msg91' | 'console'
  FAST2SMS_API_KEY: process.env.FAST2SMS_API_KEY || "",
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || "",
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || "",
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || "",
  
  // Email Notification
  EMAIL_PROVIDER: process.env.EMAIL_PROVIDER || "console", // 'smtp' | 'console'
  SMTP_HOST: process.env.SMTP_HOST || "smtp.gmail.com",
  SMTP_PORT: parseInt(process.env.SMTP_PORT || "587", 10),
  SMTP_SECURE: process.env.SMTP_SECURE === "true",
  SMTP_USER: process.env.SMTP_USER || "",
  SMTP_PASS: process.env.SMTP_PASS || "",
  EMAIL_FROM: process.env.EMAIL_FROM || '"Ojaswi Premium" <noreply@ojaswifoods.com>',
  COMPANY_NOTIFY_EMAIL: process.env.COMPANY_NOTIFY_EMAIL || "ojaswifoods@gmail.com",
  
  // WhatsApp Notification
  WHATSAPP_PROVIDER: process.env.WHATSAPP_PROVIDER || "console", // 'meta_cloud' | 'twilio' | 'console'
  WHATSAPP_OWNER_NUMBER: process.env.WHATSAPP_OWNER_NUMBER || "917972483489",
  WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
  WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN || "",
  
  // Razorpay Gateway
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || "",
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || "",
  
  // OTP Settings
  OTP_EXPIRY_MINUTES: 5,
  OTP_MAX_ATTEMPTS: 5,
  OTP_RESEND_COOLDOWN_SECONDS: 60
};
