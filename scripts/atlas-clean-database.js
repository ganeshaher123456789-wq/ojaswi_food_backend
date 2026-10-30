import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

export async function clearAllAtlasData(options = { preserveCatalog: false }) {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set in backend/.env.");
  }

  const targetDbName = process.env.MONGODB_DB_NAME || "ojaswi";

  console.log("==================================================");
  console.log("🧹 OJASWI FOODS: MONGODB ATLAS DATABASE CLEAR");
  console.log("==================================================");
  console.log(`>> Target Database: "${targetDbName}"`);

  let connected = false;
  for (let attempt = 1; attempt <= 4 && !connected; attempt++) {
    try {
      console.log(`>> Connecting to MongoDB Atlas (attempt ${attempt}/4)...`);
      await mongoose.connect(uri, {
        dbName: targetDbName,
        serverSelectionTimeoutMS: 25000,
        socketTimeoutMS: 45000
      });
      connected = true;
    } catch (connErr) {
      console.warn(`>> Connection attempt ${attempt} notice: ${connErr.message}`);
      if (attempt < 4) await new Promise((r) => setTimeout(r, 2000));
      else throw connErr;
    }
  }

  const activeDbName = mongoose.connection.name;
  if (activeDbName !== targetDbName && activeDbName !== "ojaswi") {
    throw new Error(`Safety halt: Connected database name "${activeDbName}" does not match target "ojaswi"`);
  }

  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log(`>> Connected to database "${activeDbName}" (${collections.length} collections found).`);
  console.log(">> Beginning deleteMany({}) across collections (preserving indexes & structures)...");
  console.log("--------------------------------------------------");

  const deletionReport = [];

  for (const colInfo of collections) {
    const colName = colInfo.name;
    const col = mongoose.connection.db.collection(colName);
    
    // Check initial count
    const countBefore = await col.countDocuments();
    
    // Execute deleteMany({}) to remove all documents while keeping collections and indexes
    const deleteResult = await col.deleteMany({});
    
    // Verify count after deletion
    const countAfter = await col.countDocuments();

    deletionReport.push({
      collection: colName,
      documentsBefore: countBefore,
      deletedCount: deleteResult.deletedCount,
      documentsAfter: countAfter,
      status: countAfter === 0 ? "CLEAN (0 docs)" : "FAILED"
    });
  }

  console.table(deletionReport);

  const nonZero = deletionReport.filter((r) => r.documentsAfter > 0);
  if (nonZero.length > 0) {
    throw new Error(`Verification failed: ${nonZero.length} collection(s) still have documents.`);
  }

  console.log("==================================================");
  console.log("✨ ALL COLLECTIONS SUCCESSFULLY VERIFIED WITH 0 DOCUMENTS!");
  console.log("==================================================");

  await mongoose.disconnect();
  return deletionReport;
}

if (process.argv[1]?.endsWith("atlas-clean-database.js")) {
  clearAllAtlasData()
    .then(() => {
      console.log("Database clean completed.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Database clean error:", err);
      process.exit(1);
    });
}

