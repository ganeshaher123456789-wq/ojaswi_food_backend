import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function verifyEmpty() {
  const uri = process.env.MONGODB_URI;
  const targetDbName = process.env.MONGODB_DB_NAME || "ojaswi";

  await mongoose.connect(uri, {
    dbName: targetDbName,
    serverSelectionTimeoutMS: 25000
  });

  const collections = await mongoose.connection.db.listCollections().toArray();
  const summary = [];
  let totalDocs = 0;

  for (const c of collections) {
    const col = mongoose.connection.db.collection(c.name);
    const count = await col.countDocuments();
    const indexes = await col.indexes();
    totalDocs += count;
    summary.push({
      collection: c.name,
      documentCount: count,
      indexCount: indexes.length,
      indexes: indexes.map(i => i.name).join(", "),
      status: count === 0 ? "EMPTY (Clean)" : "HAS DATA"
    });
  }

  console.log("==================================================");
  console.log(`🔎 MONGODB ATLAS VERIFICATION REPORT: "${mongoose.connection.name}"`);
  console.log("==================================================");
  console.log(`>> Total Collections: ${collections.length}`);
  console.log(`>> Total Documents:   ${totalDocs}`);
  console.log("--------------------------------------------------");
  console.table(summary);
  console.log("==================================================");

  await mongoose.disconnect();
}

verifyEmpty().catch(err => {
  console.error("Verification error:", err);
  process.exit(1);
});
