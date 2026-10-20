import app from "../server.js";
import { db } from "../config/db.js";
import { connectMongo } from "../config/mongodb.js";

async function runEndToEndCustomerAuthTests() {
  console.log("==================================================");
  console.log("🧪 STARTING COMPREHENSIVE CUSTOMER AUTHENTICATION & SECURITY TESTS");
  console.log("==================================================");

  await connectMongo();

  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const PORT = server.address().port;
  const baseUrl = `http://127.0.0.1:${PORT}`;
  console.log(`[Test Server] Running at ${baseUrl}\n`);

  let testPassed = 0;
  let testFailed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      testPassed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      testFailed++;
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  try {
    // Generate unique 10-digit phone numbers for testing (starting with 98 / 97)
    const rand8A = String(Math.floor(10000000 + Math.random() * 90000000));
    const phoneA = `98${rand8A.slice(0, 8)}`;
    const emailA = `customer_a_${rand8A}@example.com`;
    const passwordA = "SecurePass@123";
    const nameA = "Ojaswi Spices Customer A";

    const rand8B = String(Math.floor(10000000 + Math.random() * 90000000));
    const phoneB = `97${rand8B.slice(0, 8)}`;
    const emailB = `customer_b_${rand8B}@example.com`;
    const passwordB = "AnotherPass@456";
    const nameB = "Ojaswi Spices Customer B";

    // TEST 1: Register Customer A
    console.log("👉 Test 1: Customer Registration (POST /api/auth/register)");
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: nameA,
        phone: phoneA,
        email: emailA,
        password: passwordA
      })
    });
    const regData = await regRes.json();
    assert(regRes.status === 201, `Status code is 201 Created (got ${regRes.status})`);
    assert(regData.success === true, "Registration returned success: true");
    assert(Boolean(regData.token), "Registration returned a signed JWT token");
    assert(regData.user.name === nameA, "Returned user has correct name");
    assert(regData.user.phone === phoneA, "Returned user has correct phone");

    // Verify in database directly
    const dbUserA = await db.get("SELECT id, name, phone, email, password_hash, role FROM users WHERE phone = $1", [phoneA]);
    assert(Boolean(dbUserA), "Customer A saved in SQLite 'users' table");
    assert(Boolean(dbUserA.password_hash) && dbUserA.password_hash.startsWith("$2"), "Password stored as bcrypt hash");
    assert(dbUserA.role === "customer", "User assigned role 'customer'");

    // TEST 2: Duplicate Registration Handling
    console.log("\n👉 Test 2: Duplicate Registration Prevention");
    const dupRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: nameA,
        phone: phoneA,
        email: emailA,
        password: passwordA
      })
    });
    const dupData = await dupRes.json();
    assert(dupRes.status === 409, `Duplicate registration rejected with 409 Conflict (got ${dupRes.status})`);
    assert(dupData.success === false, "Duplicate registration returned success: false");

    // TEST 3: Login with Wrong Password
    console.log("\n👉 Test 3: Customer Login with Incorrect Credentials");
    const wrongPassRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: phoneA,
        password: "WrongPassword123"
      })
    });
    const wrongPassData = await wrongPassRes.json();
    assert(wrongPassRes.status === 401, `Wrong password rejected with 401 Unauthorized (got ${wrongPassRes.status})`);
    assert(wrongPassData.success === false, "Returned success: false for wrong password");

    // TEST 4: Login Customer A with Correct Password
    console.log("\n👉 Test 4: Customer Login with Correct Credentials");
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: phoneA,
        password: passwordA
      })
    });
    const loginData = await loginRes.json();
    assert(loginRes.status === 200, `Login status code is 200 OK (got ${loginRes.status})`);
    assert(loginData.success === true, "Login returned success: true");
    assert(Boolean(loginData.token), "Login returned valid JWT");
    const tokenA = loginData.token;

    // Also test login by email
    const loginEmailRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: emailA,
        password: passwordA
      })
    });
    assert(loginEmailRes.status === 200, "Customer can also log in using registered email address");

    // TEST 5: Customer Dashboard Access (GET /api/account)
    console.log("\n👉 Test 5: Customer Dashboard Data Retrieval (GET /api/account)");
    const dashRes = await fetch(`${baseUrl}/api/account`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const dashData = await dashRes.json();
    assert(dashRes.status === 200, `Dashboard status is 200 OK (got ${dashRes.status})`);
    assert(dashData.success === true, "Dashboard returned success: true");
    assert(dashData.profile.name === nameA, `Profile contains customer name: "${nameA}"`);
    assert(dashData.profile.phone === phoneA, `Profile contains customer phone: "${phoneA}"`);
    assert(dashData.profile.email === emailA, `Profile contains customer email: "${emailA}"`);
    assert(Array.isArray(dashData.recentOrders), "Dashboard provides recentOrders array");

    // TEST 6: Place an Order as Customer A and verify dashboard updates
    console.log("\n👉 Test 6: Place Order as Authenticated Customer A");
    const prod = await db.get("SELECT id FROM products WHERE is_active = 1 LIMIT 1");
    assert(Boolean(prod), "Active spice product found in catalog");

    const orderRes = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        items: [{ id: prod.id, quantity: 2 }],
        customer_name: nameA,
        customer_phone: phoneA,
        customer_email: emailA,
        payment_method: "COD",
        delivery_address: {
          fullName: nameA,
          phone: phoneA,
          houseNumber: "House 102",
          areaStreet: "Camp Road",
          city: "Malegaon",
          state: "Maharashtra",
          pincode: "423203"
        }
      })
    });
    const orderData = await orderRes.json();
    assert(orderRes.status === 200, `Order placed with 200 OK (got ${orderRes.status})`);
    assert(orderData.success === true, "Order created successfully");
    const orderIdA = orderData.orderId;
    assert(Boolean(orderIdA), `Received order ID: ${orderIdA}`);

    // Verify order is linked to Customer A in DB
    const dbOrderA = await db.get("SELECT user_id, customer_phone FROM orders WHERE id = $1", [orderIdA]);
    assert(dbOrderA.user_id === dbUserA.id, `Order user_id (${dbOrderA.user_id}) matches customer A user_id (${dbUserA.id})`);

    // Verify Customer A dashboard now lists this order
    const dashUpdatedRes = await fetch(`${baseUrl}/api/account`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const dashUpdatedData = await dashUpdatedRes.json();
    assert(dashUpdatedData.recentOrders.length >= 1, "Dashboard recentOrders contains Customer A order");
    assert(dashUpdatedData.recentOrders[0].id === orderIdA, "Order ID appears in Customer A dashboard history");

    // TEST 7: Register Customer B and verify Strict Account Isolation
    console.log("\n👉 Test 7: Customer B Account Isolation & Data Privacy");
    const regBRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: nameB,
        phone: phoneB,
        email: emailB,
        password: passwordB
      })
    });
    const regBData = await regBRes.json();
    assert(regBRes.status === 201, "Customer B registered successfully");
    const tokenB = regBData.token;

    // Customer B calls GET /api/account
    const dashBRes = await fetch(`${baseUrl}/api/account`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    const dashBData = await dashBRes.json();
    assert(dashBData.profile.phone === phoneB, "Customer B profile shows only Customer B data");
    assert(dashBData.recentOrders.length === 0, "Customer B has 0 orders (Customer A's orders NOT visible)");

    // Customer B calls GET /api/orders
    const ordersBRes = await fetch(`${baseUrl}/api/orders`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    const ordersBData = await ordersBRes.json();
    assert(ordersBData.orders.length === 0, "Customer B cannot see Customer A orders via GET /api/orders");

    // Customer B tries to directly access Customer A's order by ID
    const directAccessRes = await fetch(`${baseUrl}/api/orders/${encodeURIComponent(orderIdA)}`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    const directAccessData = await directAccessRes.json();
    assert(directAccessRes.status === 403, `Direct access by unauthorized user blocked with 403 Forbidden (got ${directAccessRes.status})`);
    assert(directAccessData.success === false, "Access denied error returned to intruder");

    // Unauthenticated user tries to directly access Customer A's order
    const anonAccessRes = await fetch(`${baseUrl}/api/orders/${encodeURIComponent(orderIdA)}`);
    assert(anonAccessRes.status === 401, `Anonymous access to registered order blocked with 401 Unauthorized (got ${anonAccessRes.status})`);

    // TEST 8: Customer A CAN access their own order by ID
    console.log("\n👉 Test 8: Authorized Owner Access to Own Order");
    const ownerAccessRes = await fetch(`${baseUrl}/api/orders/${encodeURIComponent(orderIdA)}`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const ownerAccessData = await ownerAccessRes.json();
    assert(ownerAccessRes.status === 200, "Customer A can view their own order details");
    assert(ownerAccessData.order.id === orderIdA, "Order details returned accurately for owner");

    // TEST 9: Mobile OTP Authentication Flow
    console.log("\n👉 Test 9: Mobile OTP Authentication Flow");
    const otpReqRes = await fetch(`${baseUrl}/api/auth/request-phone-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: phoneA })
    });
    const otpReqData = await otpReqRes.json();
    assert(otpReqRes.status === 200, "OTP request responded 200 OK");
    assert(otpReqData.success === true, "OTP generated and dispatched");

    // Verify active OTP recorded in otp_requests table and use generated code
    const rawOtp = otpReqData.devOtp;
    assert(Boolean(rawOtp), `Received OTP code from dispatch: ${rawOtp}`);

    const otpRecord = await db.get(
      "SELECT id, identifier, otp_hash, is_verified FROM otp_requests WHERE identifier = $1 ORDER BY id DESC LIMIT 1",
      [`+91${phoneA}`]
    );
    assert(Boolean(otpRecord), "OTP request registered in SQLite 'otp_requests' table");
    assert(otpRecord.is_verified === 0, "Initial OTP marked as unverified (is_verified = 0)");

    // Verify OTP
    const otpVerifyRes = await fetch(`${baseUrl}/api/auth/verify-phone-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: phoneA,
        otp: rawOtp
      })
    });
    const otpVerifyData = await otpVerifyRes.json();
    assert(otpVerifyRes.status === 200, "OTP verification returned 200 OK");
    assert(otpVerifyData.success === true, "OTP authentication succeeded");
    assert(Boolean(otpVerifyData.token), "JWT token returned for OTP login");

    // TEST 10: Logout & Session Invalidation
    console.log("\n👉 Test 10: Logout API (POST /api/auth/logout)");
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const logoutData = await logoutRes.json();
    assert(logoutRes.status === 200, "Logout returned 200 OK");
    assert(logoutData.success === true, "Logout returned success: true");

    // Unauthenticated GET /api/account
    const unauthRes = await fetch(`${baseUrl}/api/account`);
    assert(unauthRes.status === 401, `Unauthenticated dashboard request rejected with 401 Unauthorized (got ${unauthRes.status})`);

    // TEST 11: Owner Portal Removal Verification
    console.log("\n👉 Test 11: Owner Portal Removal & Redirection Verification");
    const adminReq = await fetch(`${baseUrl}/admin`, { redirect: "manual" });
    const isRedirect = adminReq.status === 301 || adminReq.status === 302;
    const location = adminReq.headers.get("location");
    assert(isRedirect && location === "/login", `/admin redirects cleanly to /login with 301/302 (got ${adminReq.status} -> ${location})`);

    console.log("\n==================================================");
    console.log(`🎉 ALL ${testPassed} TESTS PASSED SUCCESSFULLY!`);
    console.log(`❌ Failures: ${testFailed}`);
    console.log("==================================================");

  } finally {
    server.close();
    console.log("\n[Test Server] Closed cleanly.");
  }
}

runEndToEndCustomerAuthTests().catch((err) => {
  console.error("❌ Test suite encountered an error:", err);
  process.exit(1);
});
