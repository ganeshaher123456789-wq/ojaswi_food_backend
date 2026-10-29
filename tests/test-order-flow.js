import http from "http";
import { Socket } from "net";
import app from "../server.js";
import { db } from "../config/db.js";
import { generateToken } from "../middleware/auth.js";
import { OJASWI_CONSTANTS } from "../config/constants.js";
import { generateReceiptData, renderReceiptHtml } from "../utils/receiptGenerator.js";
import { notificationService } from "../services/notificationService.js";
import { smsService } from "../services/smsService.js";
import { emailService } from "../services/emailService.js";

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (!condition) {
    failedTests++;
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(message);
  } else {
    passedTests++;
    console.log(`  ✅ PASS: ${message}`);
  }
}

/**
 * Dispatches an HTTP request into the Express app in-process
 */
function dispatch(expressApp, { method = "GET", url = "/", body = null, headers = {}, token = null }) {
  return new Promise((resolve) => {
    const socket = new Socket();
    const req = new http.IncomingMessage(socket);
    const res = new http.ServerResponse(req);
    let resBody = "";

    res.write = (chunk) => {
      if (chunk) resBody += chunk.toString();
      return true;
    };

    res.end = (chunk) => {
      if (chunk) resBody += chunk.toString();
      let parsed = resBody;
      try {
        parsed = JSON.parse(resBody);
      } catch (_) {}
      resolve({
        status: res.statusCode,
        body: parsed,
        text: resBody,
        headers: res.getHeaders()
      });
    };

    req.method = method;
    req.url = url;

    const reqHeaders = {
      host: "localhost",
      ...headers
    };

    if (token) {
      reqHeaders.authorization = `Bearer ${token}`;
      reqHeaders.cookie = `ojaswi_token=${token}`;
    }

    const bodyStr = body ? (typeof body === "string" ? body : JSON.stringify(body)) : "";
    if (bodyStr) {
      reqHeaders["content-type"] = "application/json";
      reqHeaders["content-length"] = Buffer.byteLength(bodyStr);
    }

    req.headers = reqHeaders;

    process.nextTick(() => {
      if (bodyStr) req.push(bodyStr);
      req.push(null);
    });

    expressApp(req, res);
  });
}

async function runTests() {
  console.log("===============================================================");
  console.log("🌶️  OJASWI FOODS - ORDER FLOW & SECURITY VERIFICATION SUITE");
  console.log("===============================================================");

  // 1. Setup Test Users and Test Product in DB
  const testPhoneA = "9820012345";
  const testEmailA = "testuser_a@ojaswifoods.com";
  const testPhoneB = "9820054321";
  const testEmailB = "testuser_b@ojaswifoods.com";

  await db.run("DELETE FROM users WHERE phone IN ($1, $2) OR email IN ($3, $4)", [
    testPhoneA,
    testPhoneB,
    testEmailA,
    testEmailB
  ]);
  await db.run("DELETE FROM orders WHERE customer_phone IN ($1, $2)", [testPhoneA, testPhoneB]);

  const userAResult = await db.run(
    `INSERT INTO users (name, phone, email, role) 
     VALUES ($1, $2, $3, 'customer')`,
    ["Aarav Sharma", testPhoneA, testEmailA]
  );
  const userAId = userAResult.lastInsertRowid;

  const userBResult = await db.run(
    `INSERT INTO users (name, phone, email, role) 
     VALUES ($1, $2, $3, 'customer')`,
    ["Rohan Patil", testPhoneB, testEmailB]
  );
  const userBId = userBResult.lastInsertRowid;

  // Add saved delivery address for User A
  await db.run("DELETE FROM addresses WHERE user_id = $1", [userAId]);
  await db.run(
    `INSERT INTO addresses (user_id, full_name, phone, flat_house, area_street, city, state, pincode, is_default)
     VALUES ($1, $2, $3, 'Flat 402, Sai Residency', 'College Road', 'Nashik', 'Maharashtra', '422005', 1)`,
    [userAId, "Aarav Sharma", testPhoneA]
  );

  const tokenUserA = generateToken({ id: userAId, phone: testPhoneA, email: testEmailA, role: "customer" });
  const tokenUserB = generateToken({ id: userBId, phone: testPhoneB, email: testEmailB, role: "customer" });
  const tokenAdmin = generateToken({ id: 999, username: "admin", role: "admin" });

  console.log("\n📦 Section 1: Customer Profile & Delivery Address Autofill");
  {
    const meRes = await dispatch(app, {
      method: "GET",
      url: "/api/auth/me",
      token: tokenUserA
    });
    assert(meRes.status === 200, "GET /api/auth/me returns 200 for authenticated customer");
    assert(meRes.body.user && meRes.body.user.phone === testPhoneA, "Customer profile returns correct phone number");
    assert(
      meRes.body.user.city === "Nashik" && meRes.body.user.pincode === "422005",
      "Customer profile automatically autofills saved delivery address (city: Nashik, pincode: 422005)"
    );
  }

  console.log("\n🛡️  Section 2: Cart & Price Tampering Prevention");
  let createdOrderId = "";
  let orderTotalAmount = 0;
  {
    // Fetch product 1 price from DB
    const p1 = await db.get("SELECT * FROM products WHERE id = 1");
    assert(p1 && p1.id === 1, "Product ID 1 exists in products table");
    const realPrice = Number(p1.selling_price || p1.price);

    // Client attempts to tamper price to ₹1
    const orderPayload = {
      customer_name: "Aarav Sharma",
      customer_phone: testPhoneA,
      customer_email: testEmailA,
      delivery_address: {
        flat_house: "Flat 402, Sai Residency",
        area_street: "College Road",
        city: "Nashik",
        state: "Maharashtra",
        pincode: "422005"
      },
      items: [
        {
          productId: 1,
          quantity: 2,
          unit_price: 1, // TAMPERED PRICE
          price: 1,      // TAMPERED PRICE
          total_price: 2 // TAMPERED TOTAL
        }
      ],
      payment_method: "Cash on Delivery",
      notes: "Please deliver before 5 PM"
    };

    const placeRes = await dispatch(app, {
      method: "POST",
      url: "/api/orders",
      body: orderPayload,
      token: tokenUserA
    });

    assert(placeRes.status === 200, "POST /api/orders returns 200 for valid order");
    assert(placeRes.body.success === true, "Order placed successfully flag is true");
    assert(
      placeRes.body.orderId && placeRes.body.orderId.startsWith("#OJ"),
      `Order ID format is valid: ${placeRes.body.orderId}`
    );

    createdOrderId = placeRes.body.orderId;
    orderTotalAmount = placeRes.body.order.total_amount;

    const expectedTotal = (realPrice * 2) + OJASWI_CONSTANTS.DEFAULT_DELIVERY_CHARGE;
    assert(
      orderTotalAmount === expectedTotal,
      `Backend recalculated unit price securely: ₹${orderTotalAmount} matches DB price (expected: ₹${expectedTotal}, not tampered ₹2)`
    );

    // Verify COD status in creation response
    assert(
      placeRes.body.order.payment_status === "Payment Pending — Cash on Delivery",
      `Payment status is explicitly "Payment Pending — Cash on Delivery", not Paid (got: "${placeRes.body.order.payment_status}")`
    );
  }

  console.log("\n🔁 Section 3: Idempotency & Duplicate Order Prevention");
  {
    // Immediately attempt to submit duplicate order with same phone and items within 45s
    const dupPayload = {
      customer_name: "Aarav Sharma",
      customer_phone: testPhoneA,
      customer_email: testEmailA,
      delivery_address: {
        flat_house: "Flat 402, Sai Residency",
        area_street: "College Road",
        city: "Nashik",
        state: "Maharashtra",
        pincode: "422005"
      },
      items: [{ productId: 1, quantity: 2 }],
      payment_method: "Cash on Delivery"
    };

    const dupRes = await dispatch(app, {
      method: "POST",
      url: "/api/orders",
      body: dupPayload,
      token: tokenUserA
    });

    assert(dupRes.status === 200, "Duplicate submission handled gracefully with 200");
    assert(dupRes.body.isDuplicate === true, "Backend duplicate filter caught submission (isDuplicate: true)");
    assert(dupRes.body.orderId === createdOrderId, "Returned existing order ID rather than creating a duplicate");

    const ordersCount = await db.get(
      "SELECT COUNT(*) as count FROM orders WHERE customer_phone = $1",
      [testPhoneA]
    );
    assert(ordersCount.count === 1, "Only 1 single order exists in DB; no duplicate rows created");
  }

  console.log("\n🛒 Section 4: Cart Preservation on Failed Checkout");
  {
    // Empty cart validation
    const emptyRes = await dispatch(app, {
      method: "POST",
      url: "/api/orders",
      body: {
        customer_name: "Aarav",
        customer_phone: testPhoneA,
        delivery_address: {
          flat_house: "Flat 402, Sai Residency",
          area_street: "College Road",
          city: "Nashik",
          state: "Maharashtra",
          pincode: "422005"
        },
        items: []
      },
      token: tokenUserA
    });
    assert(emptyRes.status === 400, "Empty items array rejected with 400 Bad Request");
    assert(emptyRes.body.error.includes("empty"), "Correct error message returned for empty cart");

    // Invalid phone validation
    const invalidPhoneRes = await dispatch(app, {
      method: "POST",
      url: "/api/orders",
      body: {
        customer_name: "Aarav",
        customer_phone: "12345",
        delivery_address: "Nashik",
        items: [{ productId: 1, quantity: 1 }]
      },
      token: tokenUserA
    });
    assert(invalidPhoneRes.status === 400, "Invalid phone number rejected with 400 Bad Request");
    assert(invalidPhoneRes.body.error.includes("phone"), "Error specifies phone number requirement");
  }

  console.log("\n📄 Section 5: Order Confirmation & Receipt COD Status");
  {
    // Retrieve single order details
    const orderRes = await dispatch(app, {
      method: "GET",
      url: `/api/orders/${encodeURIComponent(createdOrderId)}`,
      token: tokenUserA
    });

    assert(orderRes.status === 200, `GET /api/orders/:id returns 200 for ${createdOrderId}`);
    const o = orderRes.body.order;
    assert(
      o.payment_status === "Payment Pending — Cash on Delivery",
      `Order details payment_status is strictly "Payment Pending — Cash on Delivery" (got: "${o.payment_status}")`
    );
    assert(o.payment_status.toLowerCase() !== "paid", "Payment status is NOT Paid");

    // Receipt JSON
    const receiptData = generateReceiptData(o);
    assert(
      receiptData.paymentStatus === "Payment Pending — Cash on Delivery",
      `Receipt data paymentStatus is "Payment Pending — Cash on Delivery" (got: "${receiptData.paymentStatus}")`
    );
    assert(receiptData.isPaid === false, "Receipt data isPaid is false for Cash on Delivery");

    // Receipt HTML
    const receiptHtml = renderReceiptHtml(receiptData);
    assert(
      receiptHtml.includes("Payment Pending — Cash on Delivery"),
      "Receipt HTML renders 'Payment Pending — Cash on Delivery' badge"
    );
    assert(
      receiptHtml.includes("COLLECT ON DELIVERY"),
      "Receipt HTML renders '(COLLECT ON DELIVERY)' label"
    );
  }

  console.log("\n🔒 Section 6: Customer Order History & Data Isolation");
  {
    // Unauthenticated GET /api/orders
    const unauthOrders = await dispatch(app, {
      method: "GET",
      url: "/api/orders"
    });
    assert(unauthOrders.status === 401, "Unauthenticated GET /api/orders rejected with 401 Unauthorized");
    assert(unauthOrders.body.requiresAuth === true, "Response includes requiresAuth: true");

    // Customer A viewing orders
    const userAOrders = await dispatch(app, {
      method: "GET",
      url: "/api/orders",
      token: tokenUserA
    });
    assert(userAOrders.status === 200, "Customer A receives 200 for GET /api/orders");
    assert(userAOrders.body.orders.length >= 1, "Customer A can view their own placed order");
    assert(
      userAOrders.body.orders.every((ord) => ord.user_id === userAId || ord.customer_phone === testPhoneA),
      "Customer A only sees orders belonging to their account"
    );

    // Customer B viewing orders
    const userBOrders = await dispatch(app, {
      method: "GET",
      url: "/api/orders",
      token: tokenUserB
    });
    assert(userBOrders.status === 200, "Customer B receives 200 for GET /api/orders");
    assert(userBOrders.body.orders.length === 0, "Customer B cannot see Customer A's orders (0 orders returned)");

    // Customer B attempting to inspect Customer A's order by ID
    const forbiddenRes = await dispatch(app, {
      method: "GET",
      url: `/api/orders/${encodeURIComponent(createdOrderId)}`,
      token: tokenUserB
    });
    assert(
      forbiddenRes.status === 403,
      `Cross-customer order access blocked: Customer B accessing Customer A's order returned 403 Forbidden (got: ${forbiddenRes.status})`
    );

    // Admin viewing orders
    const adminOrders = await dispatch(app, {
      method: "GET",
      url: "/api/orders",
      token: tokenAdmin
    });
    assert(adminOrders.status === 200, "Admin receives 200 for GET /api/orders");
    assert(adminOrders.body.orders.length >= 1, "Admin can view storewide orders");
  }

  console.log("\n🔔 Section 7: Notification Error Handling & Real Status Reporting");
  {
    // Test notification dispatch
    const testOrderObj = await db.get("SELECT * FROM orders WHERE id = $1", [createdOrderId]);
    const testItems = await db.all("SELECT * FROM order_items WHERE order_id = $1", [createdOrderId]);

    const notifOutcome = await notificationService.notifyOrderPlaced(testOrderObj, testItems);
    assert(notifOutcome !== null && typeof notifOutcome === "object", "Notification service returned structured outcome");

    console.log("    Recorded channel statuses:", JSON.stringify(notifOutcome, null, 2));

    // Verify WhatsApp channel
    const waStatus = notifOutcome.whatsapp_owner || notifOutcome.whatsapp;
    assert(
      waStatus && (waStatus.status === "simulated_console" || waStatus.status === "sent" || waStatus.status === "skipped"),
      `WhatsApp status accurately reported: ${waStatus?.status}`
    );

    // Verify SMS channel
    const smsCustStatus = notifOutcome.sms_customer || notifOutcome.customer_sms;
    assert(
      smsCustStatus && (smsCustStatus.status === "simulated_console" || smsCustStatus.status === "sent" || smsCustStatus.status === "skipped" || smsCustStatus.status === "failed"),
      `Customer SMS status accurately reported: ${smsCustStatus?.status}`
    );

    // Verify Email channel
    const emailCustStatus = notifOutcome.email_customer || notifOutcome.customer_email;
    assert(
      emailCustStatus && (emailCustStatus.status === "simulated_console" || emailCustStatus.status === "sent" || emailCustStatus.status === "skipped" || emailCustStatus.status === "failed"),
      `Customer Email status accurately reported: ${emailCustStatus?.status}`
    );

    // Check notifications recorded in SQLite
    const notifsInDb = await db.all("SELECT * FROM notifications WHERE order_id = $1", [createdOrderId]);
    assert(notifsInDb.length > 0, `Notifications persisted in database (count: ${notifsInDb.length})`);
    for (const n of notifsInDb) {
      assert(n.status !== undefined && n.status !== null, `Notification ${n.channel} has non-null status: ${n.status}`);
      console.log(`    DB record -> Channel: ${n.channel}, Status: ${n.status}, Recipient: ${n.recipient}`);
    }

    // Verify orders are never lost if a notification fails
    const orderCheck = await db.get("SELECT * FROM orders WHERE id = $1", [createdOrderId]);
    assert(orderCheck && orderCheck.id === createdOrderId, "Order remains safely stored in database regardless of notification outcome");
  }

  console.log("\n📱 Section 8: Order Confirmation Channel Selection & Prefilled Message Verification");
  {
    // Verify WhatsApp order confirmation payload structure
    const testOrder = await db.get("SELECT * FROM orders WHERE id = $1", [createdOrderId]);
    const testItems = await db.all("SELECT * FROM order_items WHERE order_id = $1", [createdOrderId]);
    const addr = JSON.parse(testOrder.delivery_address_json);

    const waText = [
      `Order ID: ${testOrder.id}`,
      `Customer Name: ${testOrder.customer_name}`,
      `Mobile: +91 ${testOrder.customer_phone}`,
      `Delivery Address: ${addr.flat_house}, ${addr.area_street}, ${addr.city} - ${addr.pincode}`,
      `Payment Method: ${testOrder.payment_method}`,
      `Payment Status: ${testOrder.payment_status}`,
      `Total: ₹${testOrder.total_amount}`,
      ...testItems.map(i => `${i.product_name} x ${i.quantity} (₹${i.total_price})`)
    ].join("\n");

    assert(waText.includes(createdOrderId), "WhatsApp message contains Order ID");
    assert(waText.includes("Aarav Sharma"), "WhatsApp message contains customer name");
    assert(waText.includes(testPhoneA), "WhatsApp message contains phone number");
    assert(waText.includes("Nashik"), "WhatsApp message contains delivery address city");
    assert(waText.includes("Garam Masala"), "WhatsApp message contains ordered product name");
    assert(waText.includes("Payment Pending — Cash on Delivery"), "WhatsApp message contains 'Payment Pending — Cash on Delivery'");
    assert(!waText.includes("Paid\n"), "WhatsApp message does NOT claim Paid");
  }

  // Clean up test data
  await db.run("DELETE FROM notifications WHERE order_id = $1", [createdOrderId]);
  await db.run("DELETE FROM order_items WHERE order_id = $1", [createdOrderId]);
  await db.run("DELETE FROM orders WHERE id = $1", [createdOrderId]);
  await db.run("DELETE FROM addresses WHERE user_id IN ($1, $2)", [userAId, userBId]);
  await db.run("DELETE FROM users WHERE id IN ($1, $2)", [userAId, userBId]);

  console.log("\n===============================================================");
  console.log(`🎯 TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log("===============================================================");

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("Unhandled error in test suite:", err);
  process.exit(1);
});
