/**
 * Test Suite: Exact Customer Receipt, Zero Default Values & Multi-User Verification
 */
import assert from "assert";
import http from "http";
import jwt from "jsonwebtoken";
import app from "../server.js";

async function runExactReceiptTests() {
  console.log("==================================================");
  console.log("  OJASWI: EXACT RECEIPT & ZERO DEFAULTS TEST SUITE");
  console.log("==================================================");

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`[TEST SERVER] Running on ${baseUrl}`);

  try {
    const tId = Date.now();

    // -------------------------------------------------------------
    // TEST 1: Exact Google Login Name Preservation
    // -------------------------------------------------------------
    console.log("\n[TEST 1] Testing Exact Google Login Name Preservation...");
    const exactName = "Ganesh Sharma";
    const userEmail = `ganesh.sharma.${tId}@gmail.com`;

    const googlePayload = {
      sub: `google_sub_${tId}_exact`,
      email: userEmail,
      name: exactName,
      picture: "https://lh3.googleusercontent.com/photo.jpg"
    };
    const googleToken = jwt.sign(googlePayload, "mock_secret");

    const authRes = await fetch(`${baseUrl}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential: googleToken })
    }).then((r) => r.json());

    assert(authRes.success, "Google sign-in failed");
    assert.strictEqual(authRes.user.name, exactName, "Exact name altered");
    assert.strictEqual(authRes.user.email, userEmail, "Exact email altered");
    console.log(`✓ Exact Google name preserved: "${authRes.user.name}"`);

    const customerToken = authRes.token;
    const customerId = authRes.user.id;

    // -------------------------------------------------------------
    // TEST 2: Rejection of Missing Delivery Address (Zero Default Values)
    // -------------------------------------------------------------
    console.log("\n[TEST 2] Testing Zero Default Values & Address Validation...");

    // 2a. Attempt order without city
    const noCityRes = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerToken}`
      },
      body: JSON.stringify({
        customer_name: exactName,
        customer_phone: "9820011223",
        customer_email: userEmail,
        delivery_address: {
          flat_house: "Flat 402, Skyline Residency",
          area_street: "Bandra West",
          // missing city, state, pincode
        },
        items: [{ productId: 1, quantity: 2 }],
        payment_method: "Cash on Delivery"
      })
    });
    assert.strictEqual(noCityRes.status, 400, "Backend must reject missing city with 400 Bad Request");
    const noCityData = await noCityRes.json();
    console.log(`✓ Rejected missing city without defaulting to Malegaon: "${noCityData.error}"`);

    // 2b. Attempt order without valid pincode
    const noPinRes = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerToken}`
      },
      body: JSON.stringify({
        customer_name: exactName,
        customer_phone: "9820011223",
        customer_email: userEmail,
        delivery_address: {
          flat_house: "Flat 402, Skyline Residency",
          area_street: "Bandra West",
          city: "Mumbai",
          state: "Maharashtra",
          pincode: "123" // invalid
        },
        items: [{ productId: 1, quantity: 2 }],
        payment_method: "Cash on Delivery"
      })
    });
    assert.strictEqual(noPinRes.status, 400, "Backend must reject invalid pincode with 400 Bad Request");
    const noPinData = await noPinRes.json();
    console.log(`✓ Rejected invalid PIN without defaulting to 423203: "${noPinData.error}"`);

    // -------------------------------------------------------------
    // TEST 3: Order Placement with Real Custom Address
    // -------------------------------------------------------------
    console.log("\n[TEST 3] Placing Order with Real Address (Mumbai, 400050)...");
    const orderId = `#OJ-EXACT-${tId}`;
    const testPhone = "9820" + Math.floor(100000 + Math.random() * 900000).toString().slice(0, 6);
    const orderRes = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerToken}`
      },
      body: JSON.stringify({
        orderId,
        customer_name: exactName,
        customer_phone: testPhone,
        delivery_address: {
          flat_house: "Flat 402, Skyline Residency",
          area_street: "Linking Road, Bandra West",
          city: "Mumbai",
          state: "Maharashtra",
          pincode: "400050"
        },
        items: [{ productId: 1, quantity: 2 }, { productId: 2, quantity: 1 }],
        payment_method: "Cash on Delivery"
      })
    }).then((r) => r.json());

    assert(orderRes.success, "Order placement failed: " + orderRes.error);
    assert.strictEqual(orderRes.order.customer_name, exactName, "Order customer name matches exact Google name");
    assert.strictEqual(orderRes.order.customer_email, userEmail, "Autofilled authenticated customer email");
    assert.strictEqual(orderRes.order.delivery_address.city, "Mumbai", "City is Mumbai (not default Malegaon)");
    assert.strictEqual(orderRes.order.delivery_address.pincode, "400050", "Pincode is 400050 (not default 423203)");
    assert(
      orderRes.order.payment_status === "CASH ON DELIVERY — PAYMENT PENDING" ||
      orderRes.order.payment_status === "Payment Pending — Cash on Delivery",
      "Payment status is Cash on Delivery Pending"
    );
    console.log(`✓ Order placed successfully with real custom details for ${exactName}!`);

    // -------------------------------------------------------------
    // TEST 4: Receipt Generation with Real Data & Exact Spelling
    // -------------------------------------------------------------
    console.log("\n[TEST 4] Verifying Tax Invoice & Receipt Details...");
    const receiptRes = await fetch(`${baseUrl}/api/orders/${encodeURIComponent(orderId)}/receipt`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    }).then((r) => r.json());

    assert(receiptRes.success, "Receipt retrieval failed");
    const receipt = receiptRes.receipt;
    assert.strictEqual(receipt.customer.name, exactName, "Receipt prints exact customer name without changing spelling");
    assert.strictEqual(receipt.customer.email, userEmail, "Receipt prints real customer email");
    assert.strictEqual(receipt.customer.phone, "+91 " + testPhone, "Receipt prints real customer phone");
    assert(receipt.customer.address.includes("Mumbai"), "Receipt contains real customer city Mumbai");
    assert(receipt.customer.address.includes("400050"), "Receipt contains real customer pincode 400050");
    assert.strictEqual(receipt.paymentStatus, "Payment Pending — Cash on Delivery", "Receipt payment status is Payment Pending — Cash on Delivery");
    assert.strictEqual(receipt.paymentMethod, "CASH ON DELIVERY", "Receipt payment method is CASH ON DELIVERY");
    assert.strictEqual(receipt.isPaid, false, "Cash on delivery receipt isPaid must be false");
    assert.strictEqual(receipt.items.length, 2, "Receipt has all 2 ordered products");
    console.log("✓ Receipt verified with exact Google name, real address, and Cash on Delivery status!");

    // -------------------------------------------------------------
    // TEST 5: Second Account (Sayali) Isolation Check
    // -------------------------------------------------------------
    console.log("\n[TEST 5] Testing Second Account (Sayali) Isolation...");
    const sayaliPayload = {
      sub: `google_sub_${tId}_sayali`,
      email: `sayali.${tId}@gmail.com`,
      name: "Sayali Patil",
      picture: "https://lh3.googleusercontent.com/sayali.jpg"
    };
    const sayaliToken = jwt.sign(sayaliPayload, "mock_secret");

    const sayaliAuth = await fetch(`${baseUrl}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential: sayaliToken })
    }).then((r) => r.json());

    assert.notStrictEqual(sayaliAuth.user.id, customerId, "User IDs must be distinct");
    assert.strictEqual(sayaliAuth.user.name, "Sayali Patil", "Sayali exact name preserved");

    // Sayali attempts to access Ganesh's order receipt
    const crossReceiptRes = await fetch(`${baseUrl}/api/orders/${encodeURIComponent(orderId)}/receipt`, {
      headers: { Authorization: `Bearer ${sayaliAuth.token}` }
    });
    assert.strictEqual(crossReceiptRes.status, 403, "Sayali must be forbidden (403) from Ganesh's receipt");
    console.log("✓ Sayali blocked with 403 Forbidden from accessing Ganesh's receipt!");

    console.log("\n==================================================");
    console.log("  ALL TESTS PASSED! ZERO DEFAULTS & RECEIPT VERIFIED");
    console.log("==================================================");
    process.exit(0);
  } finally {
    server.close();
  }
}

runExactReceiptTests().catch((err) => {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
});
