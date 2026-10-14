import { db } from "../config/db.js";

async function check() {
  const rows = await db.all("SELECT id, customer_name, customer_phone, order_status, total_amount, created_at FROM orders ORDER BY created_at DESC LIMIT 15");
  console.log("Recent 15 Orders:");
  console.table(rows);
  process.exit(0);
}

check().catch(console.error);
