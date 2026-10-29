import assert from "assert";
import jwt from "jsonwebtoken";
import { ENV } from "../config/env.js";
import { db } from "../config/db.js";
import { User, Order, Cart } from "../models/index.js";
import http from "http";

async function runIsolationTests() {
  console.log("==================================================");
  console.log("  OJASWI FOODS: CUSTOMER ISOLATION TEST SUITE");
  console.log("==================================================");

  // Dynamically import the app after env setup
  const { default: app } = await import("../server.js");

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`[TEST SERVER] Running on ${baseUrl}`);

  try {
    // -----------------------------------------------------------------
    // TEST 1: Google Login / Account Isolation for Two Separate Accounts
    // -----------------------------------------------------------------
    console.log("\n[TEST 1] Testing Google Login Isolation (Ganesh Sharma vs Sayali)...");

    // Create mock Google JWT payloads
    const testRunId = Date.now();
    const ganeshEmail = `ganesh.sharma.${testRunId}@gmail.com`;
    const sayaliEmail = `sayali.patil.${testRunId}@gmail.com`;

    const ganeshPayload = {
      sub: `google_id_ganesh_${testRunId}`,
      email: ganeshEmail,
      name: "Ganesh Sharma",
      picture: "https://lh3.googleusercontent.com/ganesh.jpg"
    };
    const ganeshGoogleToken = jwt.sign(ganeshPayload, "mock_google_secret");

    const sayaliPayload = {
      sub: `google_id_sayali_${testRunId}`,
      email: sayaliEmail,
      name: "Sayali Patil",
      picture: "https://lh3.googleusercontent.com/sayali.jpg"
    };
    const sayaliGoogleToken = jwt.sign(sayaliPayload, "mock_google_secret");

    // 1a. Sign in Ganesh
    const resGanesh = await fetch(`${baseUrl}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential: ganeshGoogleToken })
    }).then((r) => r.json());

    assert(resGanesh.success, "Ganesh Google auth failed");
    assert(resGanesh.user, "Ganesh user missing");
    const ganeshId = resGanesh.user.id;
    const ganeshToken = resGanesh.token;
    console.log(`✓ Ganesh registered/logged in: ID ${ganeshId}, Email: ${resGanesh.user.email}`);

    // 1b. Sign in Sayali
    const resSayali = await fetch(`${baseUrl}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential: sayaliGoogleToken })
    }).then((r) => r.json());

    assert(resSayali.success, "Sayali Google auth failed");
    assert(resSayali.user, "Sayali user missing");
    const sayaliId = resSayali.user.id;
    const sayaliToken = resSayali.token;
    console.log(`✓ Sayali registered/logged in: ID ${sayaliId}, Email: ${resSayali.user.email}`);

    // Verify distinct IDs
    assert.notStrictEqual(ganeshId, sayaliId, "CRITICAL: Ganesh and Sayali were assigned the same user ID!");
    assert.strictEqual(resSayali.user.email, sayaliEmail, "Sayali email incorrect");
    assert.strictEqual(resGanesh.user.email, ganeshEmail, "Ganesh email incorrect");
    console.log("✓ Google profiles are completely separate!");

    // -----------------------------------------------------------------
    // TEST 2: Customer-Specific Cart Isolation
    // -----------------------------------------------------------------
    console.log("\n[TEST 2] Testing Customer Cart Isolation...");

    // 2a. Check initial carts - Sayali should have an empty cart
    const sayaliInitCart = await fetch(`${baseUrl}/api/cart`, {
      headers: { Authorization: `Bearer ${sayaliToken}` }
    }).then((r) => r.json());
    assert.strictEqual(sayaliInitCart.items.length, 0, "New customer Sayali should start with an empty cart");
    console.log("✓ Sayali starts with 0 cart items");

    // 2b. Ganesh adds 2 packs of product 1 to his cart
    const ganeshAddRes = await fetch(`${baseUrl}/api/cart`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ganeshToken}`
      },
      body: JSON.stringify({ productId: 1, quantity: 2 })
    }).then((r) => r.json());
    assert(ganeshAddRes.success, "Ganesh add to cart failed");
    console.log("✓ Ganesh added 2 items to his cart");

    // 2c. Sayali checks her cart again - must still be 0 items!
    const sayaliCartCheck = await fetch(`${baseUrl}/api/cart`, {
      headers: { Authorization: `Bearer ${sayaliToken}` }
    }).then((r) => r.json());
    assert.strictEqual(
      sayaliCartCheck.items.length,
      0,
      "CRITICAL LEAK: Sayali saw Ganesh's cart items!"
    );
    console.log("✓ Sayali cart remains 0 items (never mixed with Ganesh's cart)");

    // 2d. Sayali adds 1 pack of product 2 to her cart
    const sayaliAddRes = await fetch(`${baseUrl}/api/cart`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sayaliToken}`
      },
      body: JSON.stringify({ productId: 2, quantity: 1 })
    }).then((r) => r.json());
    assert(sayaliAddRes.success, "Sayali add to cart failed");

    // 2e. Verify both carts are completely independent
    const ganeshFinalCart = await fetch(`${baseUrl}/api/cart`, {
      headers: { Authorization: `Bearer ${ganeshToken}` }
    }).then((r) => r.json());
    const sayaliFinalCart = await fetch(`${baseUrl}/api/cart`, {
      headers: { Authorization: `Bearer ${sayaliToken}` }
    }).then((r) => r.json());

    assert.strictEqual(ganeshFinalCart.items.length, 1, "Ganesh cart item count");
    assert.strictEqual(ganeshFinalCart.items[0].quantity, 2, "Ganesh cart item quantity");
    assert.strictEqual(sayaliFinalCart.items.length, 1, "Sayali cart item count");
    assert.strictEqual(sayaliFinalCart.items[0].quantity, 1, "Sayali cart item quantity");
    assert.notStrictEqual(ganeshFinalCart.items[0].product_id, sayaliFinalCart.items[0].product_id, "Different items");
    console.log("✓ Both carts are completely isolated per user ID!");

    // -----------------------------------------------------------------
    // TEST 3: Orders Placement & History Isolation
    // -----------------------------------------------------------------
    console.log("\n[TEST 3] Testing Private Order History Isolation (Sayali vs Ganesh)...");

    const orderIdGanesh = `#OJ-GANESH-${Date.now()}`;
    const orderIdSayali = `#OJ-SAYALI-${Date.now()}`;

    // 3a. Ganesh places an order
    const ganeshOrderRes = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ganeshToken}`
      },
      body: JSON.stringify({
        orderId: orderIdGanesh,
        customer_name: "Ganesh Sharma",
        customer_phone: "9820011223",
        customer_email: ganeshEmail,
        delivery_address: {
          flat_house: "Flat 101, Shanti Niketan",
          area_street: "College Road",
          city: "Malegaon",
          state: "Maharashtra",
          pincode: "423203"
        },
        items: [{ productId: 1, quantity: 2 }],
        payment_method: "Cash on Delivery",
        notes: "Deliver in evening"
      })
    }).then((r) => r.json());

    assert(ganeshOrderRes.success, "Ganesh order placement failed: " + ganeshOrderRes.error);
    console.log(`✓ Ganesh placed order ${orderIdGanesh}`);

    // 3b. Sayali places an order
    const sayaliOrderRes = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sayaliToken}`
      },
      body: JSON.stringify({
        orderId: orderIdSayali,
        customer_name: "Sayali Patil",
        customer_phone: "9123456789",
        customer_email: sayaliEmail,
        delivery_address: {
          flat_house: "Building B, Room 402",
          area_street: "Market Yard Road",
          city: "Malegaon",
          state: "Maharashtra",
          pincode: "423203"
        },
        items: [{ productId: 2, quantity: 1 }],
        payment_method: "Cash on Delivery"
      })
    }).then((r) => r.json());

    assert(sayaliOrderRes.success, "Sayali order placement failed: " + sayaliOrderRes.error);
    console.log(`✓ Sayali placed order ${orderIdSayali}`);

    // 3c. Ganesh fetches his order history
    const ganeshOrdersList = await fetch(`${baseUrl}/api/orders`, {
      headers: { Authorization: `Bearer ${ganeshToken}` }
    }).then((r) => r.json());
    assert(ganeshOrdersList.success, "Ganesh orders fetch failed");
    const ganeshOrderIds = ganeshOrdersList.orders.map((o) => o.id);
    assert(ganeshOrderIds.includes(orderIdGanesh), "Ganesh should see his own order");
    assert(
      !ganeshOrderIds.includes(orderIdSayali),
      "CRITICAL PRIVACY BUG: Ganesh was able to see Sayali's order in his order history!"
    );
    console.log("✓ Ganesh sees only his orders, not Sayali's");

    // 3d. Sayali fetches her order history
    const sayaliOrdersList = await fetch(`${baseUrl}/api/orders`, {
      headers: { Authorization: `Bearer ${sayaliToken}` }
    }).then((r) => r.json());
    assert(sayaliOrdersList.success, "Sayali orders fetch failed");
    const sayaliOrderIds = sayaliOrdersList.orders.map((o) => o.id);
    assert(sayaliOrderIds.includes(orderIdSayali), "Sayali should see her own order");
    assert(
      !sayaliOrderIds.includes(orderIdGanesh),
      "CRITICAL PRIVACY BUG: Sayali was able to see Ganesh's order in her order history!"
    );
    console.log("✓ Sayali sees only her orders, not Ganesh's");

    // -----------------------------------------------------------------
    // TEST 4: Direct Order ID Access Authorization Check
    // -----------------------------------------------------------------
    console.log("\n[TEST 4] Testing Direct Order and Receipt Access Authorization...");

    // 4a. Sayali attempts to view Ganesh's order details via /api/orders/:id
    const sayaliAccessGaneshOrder = await fetch(
      `${baseUrl}/api/orders/${encodeURIComponent(orderIdGanesh)}`,
      {
        headers: { Authorization: `Bearer ${sayaliToken}` }
      }
    );
    assert.strictEqual(
      sayaliAccessGaneshOrder.status,
      403,
      `Sayali should get 403 Forbidden when accessing Ganesh's order, but got ${sayaliAccessGaneshOrder.status}`
    );
    console.log("✓ Sayali blocked with 403 Forbidden from accessing Ganesh's order");

    // 4b. Sayali attempts to view Ganesh's order receipt via /api/orders/:id/receipt
    const sayaliAccessGaneshReceipt = await fetch(
      `${baseUrl}/api/orders/${encodeURIComponent(orderIdGanesh)}/receipt`,
      {
        headers: { Authorization: `Bearer ${sayaliToken}` }
      }
    );
    assert.strictEqual(
      sayaliAccessGaneshReceipt.status,
      403,
      `Sayali should get 403 Forbidden when accessing Ganesh's receipt, but got ${sayaliAccessGaneshReceipt.status}`
    );
    console.log("✓ Sayali blocked with 403 Forbidden from accessing Ganesh's order receipt");

    // 4c. Sayali accesses HER OWN order details
    const sayaliOwnOrder = await fetch(
      `${baseUrl}/api/orders/${encodeURIComponent(orderIdSayali)}`,
      {
        headers: { Authorization: `Bearer ${sayaliToken}` }
      }
    ).then((r) => r.json());
    assert(sayaliOwnOrder.success, "Sayali should access her own order");
    assert.strictEqual(sayaliOwnOrder.order.id, orderIdSayali);
    assert.strictEqual(
      sayaliOwnOrder.order.payment_status,
      "Payment Pending — Cash on Delivery",
      "Cash on Delivery status must be 'Payment Pending — Cash on Delivery'"
    );
    console.log("✓ Sayali successfully accessed her own order (Payment Status: Payment Pending — Cash on Delivery)");

    // -----------------------------------------------------------------
    // TEST 5: Unauthenticated User Order List Access
    // -----------------------------------------------------------------
    console.log("\n[TEST 5] Testing Unauthenticated Order History Access...");
    const guestOrderList = await fetch(`${baseUrl}/api/orders`).then((r) => r.json());
    assert.strictEqual(guestOrderList.requiresAuth, true, "Guest should be asked to log in");
    assert.strictEqual(guestOrderList.orders.length, 0, "No orders should be leaked to unauthenticated users");
    console.log("✓ Unauthenticated order history returns 0 orders and requiresAuth: true");

    console.log("\n==================================================");
    console.log("  ALL TESTS PASSED! FULL CUSTOMER ISOLATION VERIFIED");
    console.log("==================================================");
  } finally {
    server.close();
  }
}

runIsolationTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ TEST SUITE FAILED:", err);
    process.exit(1);
  });

