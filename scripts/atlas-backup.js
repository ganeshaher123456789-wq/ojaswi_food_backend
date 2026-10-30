import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function runBackup() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("❌ ERROR: MONGODB_URI is not set in backend/.env.");
    process.exit(1);
  }

  const targetDbName = process.env.MONGODB_DB_NAME || "ojaswi";

  console.log("==================================================");
  console.log("📦 OJASWI FOODS: MONGODB ATLAS SAFE PRE-BACKUP");
  console.log("==================================================");
  console.log(`>> Target Database: "${targetDbName}"`);

  try {
  let connected = false;
  for (let attempt = 1; attempt <= 4 && !connected; attempt++) {
    try {
      console.log(`>> Attempting connection (try ${attempt}/4)...`);
      await mongoose.connect(uri, {
        dbName: targetDbName,
        serverSelectionTimeoutMS: 25000,
        socketTimeoutMS: 45000
      });
      connected = true;
    } catch (connErr) {
      console.warn(`>> Connection attempt ${attempt} notice: ${connErr.message}`);
      if (attempt < 4) {
        await new Promise((r) => setTimeout(r, 2000));
      } else {
        throw connErr;
      }
    }
  }

    const activeDbName = mongoose.connection.name;
    console.log(`>> Connected Database: "${activeDbName}"`);

    if (activeDbName !== targetDbName && activeDbName !== "ojaswi") {
      throw new Error(`Safety halt: Connected database name "${activeDbName}" does not match target "ojaswi"`);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupDir = path.resolve(__dirname, `../database/backups/atlas_backup_${timestamp}`);
    fs.mkdirSync(backupDir, { recursive: true });

    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`>> Found ${collections.length} collections in "${activeDbName}".`);
    console.log("--------------------------------------------------");

    let totalDocs = 0;
    const summary = [];

    for (const colInfo of collections) {
      const colName = colInfo.name;
      const col = mongoose.connection.db.collection(colName);
      const docs = await col.find({}).toArray();
      const count = docs.length;
      totalDocs += count;

      const filePath = path.join(backupDir, `${colName}.json`);
      fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), "utf8");
      const stat = fs.statSync(filePath);

      summary.push({
        collection: colName,
        count: count,
        sizeBytes: stat.size,
        file: `${colName}.json`
      });
    }

    // Write manifest
    const manifest = {
      database: activeDbName,
      createdAt: new Date().toISOString(),
      totalCollections: collections.length,
      totalDocuments: totalDocs,
      backupDirectory: backupDir,
      collections: summary
    };
    fs.writeFileSync(path.join(backupDir, "_manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

    console.log(`✅ BACKUP COMPLETED SUCCESSFULLY!`);
    console.log(`>> Location: ${backupDir}`);
    console.log(`>> Total Documents Saved: ${totalDocs}`);
    console.log("--------------------------------------------------");
    console.table(summary);
    console.log("==================================================");

    await mongoose.disconnect();
    return manifest;
  } catch (err) {
    console.error("❌ Backup failed:", err.message);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
}

runBackup();
