import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { DatabaseSync } from "node:sqlite";
import pg from "pg";
import { ENV } from "./env.js";
import { connectMongo, getMongoStatus } from "./mongodb.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isMongo = Boolean(ENV.MONGODB_URI);
const isPostgres = !isMongo && !!(
  ENV.DATABASE_URL &&
  (ENV.DATABASE_URL.startsWith("postgres://") || ENV.DATABASE_URL.startsWith("postgresql://"))
);

class DatabaseAdapter {
  constructor() {
    this.isMongo = isMongo;
    this.isPostgres = isPostgres;
    this.pgPool = null;
    this.sqlite = null;

    if (this.isMongo) {
      console.log("[DB] MongoDB Atlas configured via MONGODB_URI.");
      // Connect asynchronously to MongoDB Atlas pool
      connectMongo().catch((err) => {
        console.error("[DB] Initial MongoDB connection attempt:", err.message);
      });
    }

    if (this.isPostgres) {
      console.log("[DB] Using PostgreSQL connection pool.");
      this.pgPool = new pg.Pool({
        connectionString: ENV.DATABASE_URL,
        ssl: ENV.DATABASE_URL.includes("sslmode=disable")
          ? false
          : { rejectUnauthorized: false }
      });
    }

    // Always keep SQLite initialized for local fallback & automated test runner
    const localDbDir = path.resolve(__dirname, "../database");
    const rootDbDir = path.resolve(__dirname, "../../database");
    const dbDir = fs.existsSync(localDbDir) ? localDbDir : rootDbDir;
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    const dbPath = path.resolve(dbDir, "ojaswi.db");
    
    if (!this.isPostgres) {
      console.log(`[DB] Embedded SQLite database active at: ${dbPath}`);
      this.sqlite = new DatabaseSync(dbPath);
      // Enable WAL mode for high concurrency
      try {
        this.sqlite.exec("PRAGMA journal_mode = WAL;");
        this.sqlite.exec("PRAGMA foreign_keys = ON;");
      } catch (err) {
        console.warn("[DB] Note on PRAGMA settings:", err.message);
      }
    }
  }

  // Convert postgres style $1, $2 placeholders to ? for sqlite
  formatSql(sql) {
    if (this.isPostgres) return sql;
    return sql.replace(/\$(\d+)/g, "?");
  }

  async exec(sql) {
    if (this.isPostgres) {
      const client = await this.pgPool.connect();
      try {
        await client.query(sql);
      } finally {
        client.release();
      }
    } else if (this.sqlite) {
      this.sqlite.exec(sql);
    }
  }

  async get(sql, params = []) {
    if (this.isPostgres) {
      const res = await this.pgPool.query(sql, params);
      return res.rows[0] || null;
    } else {
      const stmt = this.sqlite.prepare(this.formatSql(sql));
      const row = stmt.get(...params);
      return row ? { ...row } : null;
    }
  }

  async all(sql, params = []) {
    if (this.isPostgres) {
      const res = await this.pgPool.query(sql, params);
      return res.rows || [];
    } else {
      const stmt = this.sqlite.prepare(this.formatSql(sql));
      const rows = stmt.all(...params);
      return rows.map((r) => ({ ...r }));
    }
  }

  async run(sql, params = []) {
    if (this.isPostgres) {
      const res = await this.pgPool.query(sql, params);
      return {
        changes: res.rowCount,
        lastInsertRowid: res.rows[0]?.id || null
      };
    } else {
      const stmt = this.sqlite.prepare(this.formatSql(sql));
      const info = stmt.run(...params);
      return {
        changes: info.changes,
        lastInsertRowid: Number(info.lastInsertRowid)
      };
    }
  }

  async checkHealth() {
    if (this.isMongo) {
      const mongoStatus = getMongoStatus();
      if (!mongoStatus.connected) {
        return {
          healthy: false,
          type: "mongodb",
          status: mongoStatus.state,
          error: "MongoDB connection is not in connected state"
        };
      }
      return {
        healthy: true,
        type: "mongodb",
        status: "connected"
      };
    }

    if (this.isPostgres) {
      try {
        const client = await this.pgPool.connect();
        try {
          await client.query("SELECT 1");
          return { healthy: true, type: "postgres", status: "connected" };
        } finally {
          client.release();
        }
      } catch (err) {
        return { healthy: false, type: "postgres", error: err.message };
      }
    }

    try {
      this.sqlite.prepare("SELECT 1").get();
      return { healthy: true, type: "sqlite", status: "connected" };
    } catch (err) {
      return { healthy: false, type: "sqlite", error: err.message };
    }
  }
}

export const db = new DatabaseAdapter();
export default db;
