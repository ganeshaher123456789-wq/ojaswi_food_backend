import { db } from "../config/db.js";

async function check() {
  const rows = await db.all("SELECT id, identifier, expires_at, created_at, attempts, is_verified FROM otp_requests ORDER BY id DESC LIMIT 15");
  console.log("Recent 15 OTP requests:");
  console.table(rows);
  process.exit(0);
}

check().catch(console.error);
