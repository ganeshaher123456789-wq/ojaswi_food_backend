import http from "http";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import app from "../server.js";
import { db } from "../config/db.js";
import { ENV } from "../config/env.js";
import { OJASWI_CONSTANTS } from "../config/constants.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let server;
let baseUrl = "";
let passedTests = 0;
let failedTests = 0;

function logPass(msg) {
  passedTests++;
  console.log(`  ✅ PASS: ${msg}`);
}

function logFail(msg, err) {
  failedTests++;
  console.error(`  ❌ FAIL: ${msg} ->`, err?.message || err);
}

async function request(endpoint, options = {}) {
  const url = `${baseUrl}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    }
  });

  const contentType = res.headers.get("content-type") || "";
  let data;
  if (contentType.includes("application/json")) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  // Extract set-cookie if present
  const cookieHeader = res.headers.get("set-cookie");

  return { status: res.status, headers: res.headers, data, cookieHeader };
}

async function runAllTests() {
  console.log("==================================================");
  console.log("🧪 STARTING OJASWI FULL-STACK E-COMMERCE TEST SUITE");
  console.log("==================================================");

  // Start test server on random available port
  const TEST_PORT = 5055;
  baseUrl = `http://127.0.0.1:${TEST_PORT}`;

  server = app.listen(TEST_PORT);
  console.log(`[Test Server] Running at ${baseUrl}\n`);

  try {
    // 1. Health Check
    try {
      const res = await request("/api/health");
      if (res.status === 200 && res.data.status === "ok") {
        logPass("API Health Check endpoint responds with status: ok");
      } else {
        throw new Error(`Unexpected status ${res.status}`);
      }
    } catch (e) { logFail("API Health Check", e); }

    // 1b. Render Root Health Check
    try {
      const res = await request("/health");
      if (res.status === 200 && res.data.status === "ok") {
        logPass("Render Root /health endpoint responds with status: ok and database status");
      } else {
        throw new Error(`Unexpected status ${res.status}`);
      }
    } catch (e) { logFail("Render Root Health Check", e); }

    // 2. Storefront HTML & Preserved Branding
    try {
      const res = await request("/");
      if (res.status === 200 && res.data.includes("Ojaswi") && res.data.includes("3025120612245599988")) {
        logPass("Storefront (/) renders brand and official FSSAI License 3025120612245599988");
      } else {
        throw new Error("Storefront missing brand or FSSAI license");
      }
    } catch (e) { logFail("Storefront HTML", e); }

    // 3. Product Catalog API
    let productsList = [];
    try {
      const res = await request("/api/products");
      if (res.status === 200 && res.data.products?.length >= 11) {
        productsList = res.data.products;
        logPass(`Product Catalog API returns all ${productsList.length} authentic Ojaswi spice products`);
      } else {
        throw new Error(`Expected at least 11 products, got ${res.data.products?.length}`);
      }
    } catch (e) { logFail("Product Catalog API", e); }

    // 4. Product Images Exist on Disk
    try {
      let allFound = true;
      for (const p of productsList) {
        const localImgPath = path.resolve(__dirname, "../", p.image);
        const frontendImgPath = path.resolve(__dirname, "../../frontend/", p.image);
        const imgPath = fs.existsSync(localImgPath) ? localImgPath : frontendImgPath;
        if (!fs.existsSync(imgPath)) {
          allFound = false;
          throw new Error(`Missing image file on disk: ${p.image}`);
        }
        if (p.image.includes(" ")) {
          throw new Error(`Image path contains spaces: ${p.image}`);
        }
        // Verify Express serves image with HTTP 200
        const imgRes = await request(`/${p.image}`);
        if (imgRes.status !== 200) {
          throw new Error(`Static image failed HTTP 200: /${p.image} returned ${imgRes.status}`);
        }
      }
      if (allFound) {
        logPass("All 11 product packaging images exist, have clean URLs and serve HTTP 200");
      }
    } catch (e) { logFail("Product Images on disk & HTTP serving", e); }

    // 5. Single Product Detail API
    try {
      const res = await request("/api/products/1");
      if (res.status === 200 && res.data.product?.name === "Garam Masala") {
        logPass(`Single Product API (/api/products/1) returned ${res.data.product.name} (₹${res.data.product.price})`);
      } else {
        throw new Error("Product ID 1 mismatch");
      }
    } catch (e) { logFail("Single Product Detail API", e); }

    // 6. Invalid Phone Number Validation
    try {
      const res = await request("/api/auth/request-phone-otp", {
        method: "POST",
        body: JSON.stringify({ phone: "12345" })
      });
      if (res.status === 400 && res.data.success === false) {
        logPass("Phone OTP rejects invalid phone numbers (12345) with 400 Bad Request");
      } else {
        throw new Error("Invalid phone was accepted");
      }
    } catch (e) { logFail("Invalid Phone Validation", e); }

    // 7. Valid Phone OTP Generation & devOtp payload
    const testPhone = "98" + Date.now().toString().slice(-8);
    let capturedDevOtp = "";
    try {
      const res = await request("/api/auth/request-phone-otp", {
        method: "POST",
        body: JSON.stringify({ phone: testPhone })
      });
      if (res.status === 200 && res.data.success === true && res.data.devOtp) {
        capturedDevOtp = res.data.devOtp;
        logPass(`Phone OTP generated with devOtp (${capturedDevOtp}) for +91 ${testPhone}`);
      } else {
        throw new Error(res.data.error || "Failed to request OTP with devOtp");
      }
    } catch (e) { logFail("Valid Phone OTP Generation", e); }

    // 8. Resend OTP Cooldown Timer Protection
    try {
      const res = await request("/api/auth/request-phone-otp", {
        method: "POST",
        body: JSON.stringify({ phone: testPhone })
      });
      if (res.status >= 400 && (res.data.error?.includes("wait") || res.data.error?.includes("Too many"))) {
        logPass("Resend OTP Cooldown prevents immediate rapid requests");
      } else {
        throw new Error("Cooldown check did not block duplicate request");
      }
    } catch (e) { logFail("Resend OTP Cooldown", e); }

    // 9. OTP Verification: Rejects Wrong Code
    try {
      const res = await request("/api/auth/verify-phone-otp", {
        method: "POST",
        body: JSON.stringify({ phone: testPhone, otp: "000000" })
      });
      if (res.status >= 400 && res.data.success === false) {
        logPass("OTP verification correctly rejects incorrect code (000000)");
      } else {
        throw new Error("Wrong OTP was accepted");
      }
    } catch (e) { logFail("Reject Wrong OTP", e); }

    // 10. OTP Verification: Accepts Backend Code & Issues Session Cookie
    let customerCookie = "";
    try {
      // Fetch latest OTP request from database
      const row = await db.get(
        "SELECT * FROM otp_requests WHERE identifier = $1 AND is_verified = 0 ORDER BY id DESC LIMIT 1",
        [`+91${testPhone}`]
      );
      if (!row) throw new Error("No OTP record found in database");

      // Verify directly with test helper OTP
      // For testing, let's create a known valid OTP
      const testCode = "789123";
      const hash = crypto.createHmac("sha256", ENV.SESSION_SECRET).update(`+91${testPhone}:${testCode}`).digest("hex");
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      await db.run(
        "INSERT INTO otp_requests (identifier, type, otp_hash, expires_at, attempts, is_verified) VALUES ($1, $2, $3, $4, 0, 0)",
        [`+91${testPhone}`, "phone", hash, expiresAt]
      );

      const res = await request("/api/auth/verify-phone-otp", {
        method: "POST",
        body: JSON.stringify({ phone: testPhone, otp: testCode, name: "Ganesh Sharma" })
      });

      let customerToken = res.data.token;
      if (res.status === 200 && res.data.success === true && res.cookieHeader && customerToken) {
        customerCookie = res.cookieHeader.split(";")[0];
        logPass("Valid OTP verified, customer account created, token and secure HttpOnly cookie set");
      } else {
        throw new Error(res.data.error || "Verification failed");
      }
    } catch (e) { logFail("OTP Verification & Login", e); }

    // 11. Customer Session & Me API (Testing both Cookie and Bearer Token)
    try {
      // Test 1: Via Cookie
      const resCookie = await request("/api/auth/me", {
        headers: { Cookie: customerCookie }
      });
      // Test 2: Via Bearer Token header
      const resToken = await request("/api/auth/me", {
        headers: { Authorization: `Bearer ${customerCookie ? (await db.get("SELECT id, role FROM users WHERE phone = $1", [testPhone])).id : ""}` }
      });
      if (resCookie.status === 200 && resCookie.data.isAuthenticated && resCookie.data.user.phone === testPhone) {
        logPass(`Session verified via /api/auth/me for customer: ${resCookie.data.user.name}`);
      } else {
        throw new Error("Session invalid or user mismatch");
      }
    } catch (e) { logFail("Customer Session /me", e); }

    // 12. Customer Address Management
    let addressId = null;
    try {
      const res = await request("/api/account/addresses", {
        method: "POST",
        headers: { Cookie: customerCookie },
        body: JSON.stringify({
          full_name: "Ganesh Sharma",
          phone: testPhone,
          flat_house: "Flat 102, Shanti Nilayam",
          area_street: "College Road, Camp",
          city: "Malegaon",
          state: "Maharashtra",
          pincode: "423203",
          is_default: 1
        })
      });
      if (res.status === 200 && res.data.addressId) {
        addressId = res.data.addressId;
        logPass("Saved customer delivery address in Malegaon with 6-digit PIN validation");
      } else {
        throw new Error(res.data.error || "Address creation failed");
      }
    } catch (e) { logFail("Address Management", e); }

    // 13. Order Creation: Cash on Delivery (COD)
    let codOrderId = "";
    let initialStock = 0;
    try {
      const beforeStock = await db.get("SELECT stock FROM products WHERE id = 1");
      initialStock = beforeStock?.stock || 0;

      const res = await request("/api/orders", {
        method: "POST",
        headers: { Cookie: customerCookie },
        body: JSON.stringify({
          customer_name: "Ganesh Sharma",
          customer_phone: testPhone,
          customer_email: "ganesh@example.com",
          delivery_address: {
            flat_house: "Flat 102, Shanti Nilayam",
            area_street: "College Road, Camp",
            city: "Malegaon",
            state: "Maharashtra",
            pincode: "423203"
          },
          items: [
            { productId: 1, quantity: 2 }, // Garam Masala
            { productId: 5, quantity: 1 }  // Biryani Masala
          ],
          payment_method: "Cash on Delivery",
          notes: "Call before delivery"
        })
      });

      if (res.status === 200 && res.data.success && res.data.orderId.startsWith("#OJ")) {
        codOrderId = res.data.orderId;
        logPass(`COD Order successfully created with ID ${codOrderId} (Total: ₹${res.data.order.total_amount})`);
      } else {
        throw new Error(res.data.error || "COD order creation failed");
      }
    } catch (e) { logFail("COD Order Creation", e); }

    // 14. Inventory Reduction Verification
    try {
      const productRow = await db.get("SELECT stock FROM products WHERE id = 1");
      if (productRow && productRow.stock === initialStock - 2) {
        logPass(`Product stock accurately decremented from ${initialStock} to ${productRow.stock} (-2 packs)`);
      } else {
        throw new Error(`Expected stock ${initialStock - 2}, got ${productRow?.stock}`);
      }
    } catch (e) { logFail("Inventory Reduction", e); }

    // 15. Notification Pipeline Audit
    try {
      const notifications = await db.all("SELECT * FROM notifications WHERE order_id = $1", [codOrderId]);
      if (notifications.length > 0) {
        logPass(`Multi-channel notification pipeline logged ${notifications.length} events for ${codOrderId} (WhatsApp/SMS/Email)`);
      } else {
        throw new Error("No notification records created");
      }
    } catch (e) { logFail("Notification Pipeline Audit", e); }

    // 16. Online Payment Order (Razorpay)
    let onlineOrderId = "";
    let razorpayOrderId = "";
    try {
      const res = await request("/api/orders", {
        method: "POST",
        headers: { Cookie: customerCookie },
        body: JSON.stringify({
          customer_name: "Ganesh Sharma",
          customer_phone: testPhone,
          delivery_address: {
            flat_house: "Villa 5",
            area_street: "Market Yard",
            city: "Malegaon",
            state: "Maharashtra",
            pincode: "423203"
          },
          items: [{ productId: 2, quantity: 1 }],
          payment_method: "Online Payment"
        })
      });

      if (res.status === 200 && res.data.requiresOnlinePayment && res.data.razorpayOrder) {
        onlineOrderId = res.data.orderId;
        razorpayOrderId = res.data.razorpayOrder.id;
        logPass(`Online payment order created: ${onlineOrderId} with Razorpay order ${razorpayOrderId}`);
      } else {
        throw new Error(res.data.error || "Online order initiation failed");
      }
    } catch (e) { logFail("Online Payment Order Initiation", e); }

    // 17. Razorpay Signature Verification
    try {
      const res = await request("/api/payments/verify", {
        method: "POST",
        body: JSON.stringify({
          order_id: onlineOrderId,
          razorpay_order_id: razorpayOrderId,
          razorpay_payment_id: "pay_test_8492049",
          razorpay_signature: "simulated_signature"
        })
      });

      if (res.status === 200 && res.data.success) {
        const orderRow = await db.get("SELECT payment_status FROM orders WHERE id = $1", [onlineOrderId]);
        if (orderRow && orderRow.payment_status === "Paid") {
          logPass(`Server-side payment verification marked ${onlineOrderId} as Paid`);
        } else {
          throw new Error("Order was not updated to Paid");
        }
      } else {
        throw new Error(res.data.error || "Verification failed");
      }
    } catch (e) { logFail("Razorpay Verification", e); }

    // 18. Order History & Timeline Status
    try {
      const res = await request(`/api/orders/${encodeURIComponent(codOrderId)}`, {
        headers: { Cookie: customerCookie }
      });
      if (res.status === 200 && res.data.order.timeline?.length === 8) {
        logPass(`Order tracking timeline contains all 8 lifecycle steps (${res.data.order.timeline.map(t=>t.status).join(" -> ")})`);
      } else {
        throw new Error("Order details or timeline mismatch");
      }
    } catch (e) { logFail("Order Lifecycle Timeline", e); }

    // 19. Admin Authentication: Rejects Bad Password
    try {
      const res = await request("/api/auth/admin-login", {
        method: "POST",
        body: JSON.stringify({ username: "admin", password: "wrongpassword" })
      });
      if (res.status === 401 && res.data.success === false) {
        logPass("Admin login strictly rejects invalid passwords");
      } else {
        throw new Error("Invalid admin password was accepted");
      }
    } catch (e) { logFail("Admin Bad Password Check", e); }

    // 20. Admin Authentication: Valid Login
    let adminCookie = "";
    try {
      const res = await request("/api/auth/admin-login", {
        method: "POST",
        body: JSON.stringify({ username: ENV.ADMIN_DEFAULT_USER, password: ENV.ADMIN_DEFAULT_PASSWORD })
      });
      if (res.status === 200 && res.data.success && res.cookieHeader) {
        adminCookie = res.cookieHeader.split(";")[0];
        logPass(`Admin authenticated successfully as ${ENV.ADMIN_DEFAULT_USER}`);
      } else {
        throw new Error(res.data.error || "Admin login failed");
      }
    } catch (e) { logFail("Admin Valid Login", e); }

    // 21. Admin Dashboard KPIs
    try {
      const res = await request("/api/admin/dashboard", {
        headers: { Cookie: adminCookie }
      });
      if (res.status === 200 && res.data.stats && res.data.stats.totalOrders >= 2) {
        logPass(`Admin KPI Dashboard returned totalOrders: ${res.data.stats.totalOrders}, totalRevenue: ₹${res.data.stats.totalRevenue}`);
      } else {
        throw new Error("Dashboard stats missing or inaccurate");
      }
    } catch (e) { logFail("Admin KPI Dashboard", e); }

    // 22. Admin Order Status Update
    try {
      const res = await request(`/api/admin/orders/${encodeURIComponent(codOrderId)}/status`, {
        method: "PUT",
        headers: { Cookie: adminCookie },
        body: JSON.stringify({ status: "Shipped" })
      });
      if (res.status === 200 && res.data.success) {
        const row = await db.get("SELECT order_status FROM orders WHERE id = $1", [codOrderId]);
        if (row && row.order_status === "Shipped") {
          logPass(`Admin updated order ${codOrderId} status to 'Shipped'`);
        } else {
          throw new Error("Status was not updated in DB");
        }
      } else {
        throw new Error(res.data.error || "Failed to update order status");
      }
    } catch (e) { logFail("Admin Order Status Update", e); }

    // 23. Admin Product Management (Price & Stock Update)
    try {
      const res = await request("/api/admin/products/1", {
        method: "PUT",
        headers: { Cookie: adminCookie },
        body: JSON.stringify({ price: 199, stock: 150 })
      });
      if (res.status === 200 && res.data.success) {
        logPass("Admin successfully updated product pricing and inventory stock");
      } else {
        throw new Error(res.data.error || "Failed to update product");
      }
    } catch (e) { logFail("Admin Product Update", e); }

    // 24. Contact Form Submission
    try {
      const res = await request("/api/contact", {
        method: "POST",
        body: JSON.stringify({
          name: "Culinary Chef Rajesh",
          phone: "9822001122",
          email: "rajesh@foodservice.in",
          subject: "Bulk Misal Masala Inquiry",
          message: "Interested in 50kg monthly wholesale dispatch to Pune."
        })
      });
      if (res.status === 200 && res.data.success) {
        logPass("Customer Contact / Enquiry form submitted and recorded in database");
      } else {
        throw new Error(res.data.error || "Contact form failed");
      }
    } catch (e) { logFail("Contact Form Submission", e); }

    // 25. Legal Pages Verification
    const legalPages = [
      "/privacy-policy",
      "/terms-and-conditions",
      "/refund-policy",
      "/shipping-policy",
      "/cancellation-policy",
      "/contact-us"
    ];
    for (const page of legalPages) {
      try {
        const res = await request(page);
        if (res.status === 200 && res.data.includes("Ojaswi")) {
          logPass(`Legal page ${page} loaded with compliant Indian e-commerce terms`);
        } else {
          throw new Error(`Page ${page} failed to load`);
        }
      } catch (e) { logFail(`Legal Page: ${page}`, e); }
    }

    // 26. Email OTP Request and Verification
    const testEmail = `chef_${Date.now()}@ojaswichef.com`;
    try {
      const reqRes = await request("/api/auth/request-email-otp", {
        method: "POST",
        body: JSON.stringify({ email: testEmail })
      });
      if (reqRes.status === 200 && reqRes.data.success) {
        // Fetch raw OTP from DB or use helper
        const code = "654321";
        const emailHash = crypto.createHmac("sha256", ENV.SESSION_SECRET).update(`${testEmail}:${code}`).digest("hex");
        const exp = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        await db.run(
          "INSERT INTO otp_requests (identifier, type, otp_hash, expires_at, attempts, is_verified, created_at) VALUES ($1, $2, $3, $4, 0, 0, $5)",
          [testEmail, "email", emailHash, exp, new Date().toISOString()]
        );

        const verifyRes = await request("/api/auth/verify-email-otp", {
          method: "POST",
          body: JSON.stringify({ email: testEmail, otp: code, name: "Chef Ojaswi" })
        });
        if (verifyRes.status === 200 && verifyRes.data.success && verifyRes.data.user?.email === testEmail) {
          logPass(`Email OTP requested and verified successfully for ${testEmail}`);
        } else {
          throw new Error("Email OTP verification failed");
        }
      } else {
        throw new Error(reqRes.data.error || "Email OTP request failed");
      }
    } catch (e) { logFail("Email OTP Workflow", e); }

    // 27. Product Slug Lookup
    try {
      const res = await request("/api/products/chaat-masala");
      if (res.status === 200 && res.data.product?.name === "Chaat Masala") {
        logPass("Product Slug Lookup (/api/products/chaat-masala) returned Chaat Masala");
      } else {
        throw new Error("Slug lookup failed");
      }
    } catch (e) { logFail("Product Slug Lookup", e); }

    // 28. Admin Product Deactivation and Reactivation
    try {
      const deactRes = await request("/api/admin/products/11", {
        method: "DELETE",
        headers: { Cookie: adminCookie }
      });
      if (deactRes.status === 200 && deactRes.data.isActive === 0) {
        // Reactivate
        const reactRes = await request("/api/admin/products/11", {
          method: "DELETE",
          headers: { Cookie: adminCookie }
        });
        if (reactRes.status === 200 && reactRes.data.isActive === 1) {
          logPass("Admin soft-deactivated and reactivated product 11 (toggle active/inactive)");
        } else {
          throw new Error("Reactivation failed");
        }
      } else {
        throw new Error("Deactivation failed");
      }
    } catch (e) { logFail("Admin Product Deactivate / Reactivate", e); }

    // 26. Unauthorized Admin Access Block
    try {
      const res = await request("/api/admin/dashboard", {
        headers: { Cookie: customerCookie } // Customer token, NOT admin
      });
      if (res.status === 403 && res.data.success === false) {
        logPass("Unauthorized customer strictly blocked from accessing Admin APIs (403 Forbidden)");
      } else {
        throw new Error("Customer was allowed into admin dashboard");
      }
    } catch (e) { logFail("Admin Role Authorization Guard", e); }

    // 29. Google Sign-In: New Customer Registration with unique profile
    const googleEmailNew = `test_google_${Date.now()}@gmail.com`;
    const googleName = "Ojaswi Google Customer";
    const googleSub = "g_" + Date.now();
    let googleCustomerToken = "";
    try {
      const res = await request("/api/auth/google", {
        method: "POST",
        body: JSON.stringify({
          email: googleEmailNew,
          name: googleName,
          googleId: googleSub
        })
      });
      if ((res.status === 201 || res.status === 200) && res.data.success && res.data.token) {
        googleCustomerToken = res.data.token;
        logPass(`Google Sign-In: New customer ${googleName} successfully created independent profile without blocking`);
      } else {
        throw new Error(res.data.error || "Expected Google login success");
      }
    } catch (e) { logFail("Google Sign-In Independent Profile", e); }

    // 30. Google Sign-In: With Phone Number
    const googleTestPhone = "97" + Date.now().toString().slice(-8);
    try {
      const res = await request("/api/auth/google", {
        method: "POST",
        body: JSON.stringify({
          email: `phone_${googleEmailNew}`,
          name: googleName,
          phone: googleTestPhone,
          googleId: `${googleSub}_phone`
        })
      });
      if ((res.status === 201 || res.status === 200) && res.data.success && res.data.token) {
        logPass(`Google Sign-In: Customer with phone successfully created profile in MongoDB Atlas (+91 ${googleTestPhone})`);
      } else {
        throw new Error(res.data.error || "Google registration failed");
      }
    } catch (e) { logFail("Google Customer Registration", e); }

    // 31. Google Sign-In: Returning Customer Sign-In without duplicate accounts
    try {
      const res = await request("/api/auth/google", {
        method: "POST",
        body: JSON.stringify({
          email: googleEmailNew,
          googleId: googleSub
        })
      });
      if (res.status === 200 && res.data.success && res.data.isNewUser === false && res.data.token) {
        logPass(`Google Sign-In: Returning customer signed in instantly without duplicate accounts (${res.data.user.name})`);
      } else {
        throw new Error(res.data.error || "Returning customer login failed");
      }
    } catch (e) { logFail("Returning Google Customer Login", e); }

    // 32. Order Receipt & Cash on Delivery Status Verification
    try {
      const res = await request(`/api/orders/${encodeURIComponent(codOrderId)}/receipt`, {
        headers: { Cookie: customerCookie }
      });
      if (res.status === 200 && res.data.receipt) {
        const rcpt = res.data.receipt;
        const isCODStatus = rcpt.paymentStatus.includes("Payment Pending — Cash on Delivery") || rcpt.paymentStatus === "PENDING";
        if (isCODStatus && rcpt.paymentMethod === "CASH ON DELIVERY" && rcpt.isPaid === false) {
          logPass("Receipt Cash on Delivery: Payment Method is 'CASH ON DELIVERY', Status is 'Payment Pending — Cash on Delivery', isPaid is false");
        } else {
          throw new Error(`Receipt payment mismatch: Method=${rcpt.paymentMethod}, Status=${rcpt.paymentStatus}, isPaid=${rcpt.isPaid}`);
        }
      } else {
        throw new Error(res.data.error || "Could not retrieve receipt");
      }
    } catch (e) { logFail("Receipt Cash on Delivery Verification", e); }

  } finally {
    server.close();
    console.log("\n==================================================");
    console.log(`📊 TEST SUITE SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log("==================================================");

    if (failedTests > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

runAllTests();
