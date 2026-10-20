import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "../config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initDatabase() {
  try {
    const schemaPath = path.resolve(__dirname, "schema.sql");
    const schemaSql = fs.readFileSync(schemaPath, "utf-8");

    if (db.isPostgres) {
      const pgSchema = schemaSql
        .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, "SERIAL PRIMARY KEY")
        .replace(/REAL/g, "NUMERIC(10,2)");
      await db.exec(pgSchema);
    } else {
      await db.exec(schemaSql);

      // Safe column migration for existing sqlite database
      const safeAddColumn = async (table, colDef) => {
        try {
          await db.exec(`ALTER TABLE ${table} ADD COLUMN ${colDef}`);
        } catch {
          // Column already exists
        }
      };

      await safeAddColumn("users", "password_hash TEXT");
      await safeAddColumn("products", "sku TEXT");
      await safeAddColumn("products", "category TEXT DEFAULT 'Authentic Spices'");
      await safeAddColumn("products", "location TEXT DEFAULT '52/2, Malegaon - 423203, Nashik, Maharashtra, India'");
      await safeAddColumn("products", "images_json TEXT");
      await safeAddColumn("orders", "discount_amount REAL DEFAULT 0");
      await safeAddColumn("orders", "tracking_note TEXT");
      await safeAddColumn("orders", "delivery_spot TEXT");
      await safeAddColumn("orders", "dispatched_at TIMESTAMP");
      await safeAddColumn("orders", "delivered_at TIMESTAMP");
      await safeAddColumn("order_items", "product_image TEXT");
      await safeAddColumn("order_items", "product_location TEXT");
      await safeAddColumn("order_items", "sku TEXT");
    }
    console.log("[DB] Schema initialized successfully.");
  } catch (err) {
    console.error("[DB] Error initializing schema:", err);
    throw err;
  }
}
