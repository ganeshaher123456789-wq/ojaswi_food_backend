import app from "../server.js";

async function verify() {
  const PORT = 5055;
  const server = app.listen(PORT, "0.0.0.0");
  const baseUrl = `http://127.0.0.1:${PORT}`;

  console.log(`[Verification Server] Started at ${baseUrl}`);

  try {
    // 1. GET /health
    const resHealth = await fetch(`${baseUrl}/health`);
    const dataHealth = await resHealth.json();
    console.log("1. GET /health:", resHealth.status, dataHealth);

    // 2. GET /api/health
    const resApiHealth = await fetch(`${baseUrl}/api/health`);
    const dataApiHealth = await resApiHealth.json();
    console.log("2. GET /api/health:", resApiHealth.status, dataApiHealth);

    // 3. GET /api/products
    const resProducts = await fetch(`${baseUrl}/api/products`);
    const dataProducts = await resProducts.json();
    console.log("3. GET /api/products:", resProducts.status, "Products count:", dataProducts.products?.length);

    // 4. CORS headers with Origin: https://ojaswi.vercel.app
    const resCors = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: "https://ojaswi.vercel.app" }
    });
    console.log("4. CORS Allow-Origin:", resCors.headers.get("access-control-allow-origin"));
    console.log("   CORS Allow-Credentials:", resCors.headers.get("access-control-allow-credentials"));

    // 5. Check if /health accurately reports when DB status is checked
    if (dataHealth.status === "ok" && dataHealth.databaseConnected === true) {
      console.log("✅ HEALTH CHECK VERIFICATION PASSED: Database connected and reported accurately.");
    } else {
      console.error("❌ HEALTH CHECK FAILED");
    }
  } finally {
    server.close();
    console.log("[Verification Server] Stopped cleanly.");
  }
}

verify().catch(console.error);
