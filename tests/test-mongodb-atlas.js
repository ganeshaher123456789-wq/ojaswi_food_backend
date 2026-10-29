import mongoose from "mongoose";
import http from "http";
import app, { startServer } from "../server.js";
import { ENV } from "../config/env.js";
import { connectMongo, getMongoStatus } from "../config/mongodb.js";
import { generateToken } from "../middleware/auth.js";
import {
  User,
  Product,
  Category,
  Cart,
  Order,
  Payment,
  Address,
  OtpRequest,
  Review,
  ContactEnquiry,
  Notification
} from "../models/index.js";

const PORT = 5088;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const contentType = res.headers.get("content-type") || "";
  let data;
  if (contentType.includes("application/json")) {
    data = await res.json();
  } else {
    data = await res.text();
  }
  return { status: res.status, data, headers: res.headers };
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(message);
  }
  console.log(`✅ PASS: ${message}`);
}

async function runMongoDBAtlasTests() {
  console.log("==================================================");
  console.log("🍃 TESTING MONGODB ATLAS INTEGRATION & NEW ROUTES");
  console.log("==================================================");

  let server;
  try {
    // 1. Connect and Start Server
    await connectMongo();
    server = app.listen(PORT);
    
    // Allow up to 15s for Atlas handshake to complete
    for (let i = 0; i < 30 && mongoose.connection.readyState !== 1; i++) {
      await new Promise((r) => setTimeout(r, 500));
    }

    // 2. Test Health Check for MongoDB Atlas status
    const healthRes = await request("/health");
    assert(healthRes.status === 200, "Health check responds with 200 OK");
    assert(healthRes.data.status === "ok", "App health status is 'ok'");
    assert(healthRes.data.databaseConnected === true, "Database is reported as connected");
    assert(healthRes.data.mongoAtlas?.connected === true, "MongoDB Atlas is connected in health check");

    // 3. Verify Collections in MongoDB Atlas
    const userCount = await User.countDocuments();
    const productCount = await Product.countDocuments();
    const categoryCount = await Category.countDocuments();
    const orderCount = await Order.countDocuments();
    const paymentCount = await Payment.countDocuments();
    const addressCount = await Address.countDocuments();
    const reviewCount = await Review.countDocuments();
    const enquiryCount = await ContactEnquiry.countDocuments();
    const notificationCount = await Notification.countDocuments();

    console.log(`>> MongoDB Atlas Document Counts:`);
    console.log(`   - Users:         ${userCount}`);
    console.log(`   - Products:      ${productCount}`);
    console.log(`   - Categories:    ${categoryCount}`);
    console.log(`   - Orders:        ${orderCount}`);
    console.log(`   - Payments:      ${paymentCount}`);
    console.log(`   - Addresses:     ${addressCount}`);
    console.log(`   - Reviews:       ${reviewCount}`);
    console.log(`   - Enquiries:     ${enquiryCount}`);
    console.log(`   - Notifications: ${notificationCount}`);

    assert(productCount >= 11, `Product collection contains ${productCount} items (expected >= 11)`);
    assert(categoryCount === 7, `Category collection contains 7 categories`);
    assert(userCount > 0, `User collection contains existing user records (${userCount})`);
    assert(orderCount > 0, `Order collection contains existing orders (${orderCount})`);

    // 4. Test Category API routes
    const catRes = await request("/api/categories");
    assert(catRes.status === 200, "GET /api/categories returns 200");
    assert(catRes.data.categories.length === 7, "Returned all 7 spice categories");
    assert(catRes.data.categories.some(c => c.slug === "blended-masala"), "Categories include 'blended-masala'");

    const singleCatRes = await request("/api/categories/blended-masala");
    assert(singleCatRes.status === 200, "GET /api/categories/blended-masala returns 200");
    assert(singleCatRes.data.category.name === "Blended Masala", "Category name is 'Blended Masala'");

    // 5. Test Cart API routes with Guest Session
    const guestCartId = `test-cart-${Date.now()}`;
    const cartHeaders = { "x-cart-id": guestCartId };

    // 5a. Get empty cart
    const emptyCartRes = await request("/api/cart", { headers: cartHeaders });
    assert(emptyCartRes.status === 200, "GET /api/cart returns 200");
    const emptyItems = emptyCartRes.data.cart?.items || emptyCartRes.data.items || [];
    assert(emptyItems.length === 0, "Initial guest cart is empty");

    // 5b. Add product to cart
    const addCartRes = await request("/api/cart", {
      method: "POST",
      headers: cartHeaders,
      body: JSON.stringify({ productId: 1, quantity: 2 })
    });
    assert(addCartRes.status === 200, "POST /api/cart returns 200");
    assert(addCartRes.data.cart.items.length === 1, "Cart now has 1 distinct product");
    assert(addCartRes.data.cart.items[0].quantity === 2, "Cart item has quantity 2");
    assert(addCartRes.data.cart.subtotal === 398, "Cart subtotal calculated correctly (199 * 2 = 398)");

    // 5c. Update cart item quantity
    const updateCartRes = await request("/api/cart", {
      method: "PUT",
      headers: cartHeaders,
      body: JSON.stringify({ productId: 1, quantity: 4 })
    });
    assert(updateCartRes.status === 200, "PUT /api/cart returns 200");
    assert(updateCartRes.data.cart.items[0].quantity === 4, "Cart item quantity updated to 4");
    assert(updateCartRes.data.cart.subtotal === 796, "Cart subtotal updated to 796");

    // 5d. Sync cart
    const syncCartRes = await request("/api/cart/sync", {
      method: "POST",
      headers: cartHeaders,
      body: JSON.stringify({
        items: [
          { id: 1, quantity: 1, name: "Garam Masala", price: 199, selling_price: 199 },
          { id: 2, quantity: 2, name: "Biryani Masala", price: 199, selling_price: 199 }
        ]
      })
    });
    assert(syncCartRes.status === 200, "POST /api/cart/sync returns 200");
    assert(syncCartRes.data.cart.items.length === 2, "Synced cart has 2 products");
    assert(syncCartRes.data.cart.subtotal === 597, "Synced cart subtotal is 597 (199 + 398)");

    // 5e. Remove item from cart
    const removeCartRes = await request("/api/cart/1", {
      method: "DELETE",
      headers: cartHeaders
    });
    assert(removeCartRes.status === 200, "DELETE /api/cart/1 returns 200");
    assert(removeCartRes.data.cart.items.length === 1, "Cart now has 1 item after deletion");

    // 5f. Clear cart
    const clearCartRes = await request("/api/cart", {
      method: "DELETE",
      headers: cartHeaders
    });
    assert(clearCartRes.status === 200, "DELETE /api/cart returns 200");
    assert(clearCartRes.data.cart.items.length === 0, "Cart is now completely cleared");

    // 6. Test Receipt Generation with Real Order Data
    // Find an existing order in MongoDB Atlas
    const testOrder = await Order.findOne({ id: { $exists: true } }).lean();
    assert(Boolean(testOrder), `Found sample order in MongoDB Atlas: ${testOrder?.id}`);

    const adminToken = generateToken({ id: testOrder?.user_id || 1, role: "admin" });
    const authHeaders = { Authorization: `Bearer ${adminToken}` };

    const receiptJsonRes = await request(`/api/orders/${encodeURIComponent(testOrder.id)}/receipt`, { headers: authHeaders });
    assert(receiptJsonRes.status === 200, `GET /api/orders/${testOrder.id}/receipt returns 200`);
    assert(receiptJsonRes.data.receipt.order_id === testOrder.id, "Receipt order_id matches");
    assert(Boolean(receiptJsonRes.data.receipt.fssai_license), "Receipt includes official FSSAI License");
    assert(Boolean(receiptJsonRes.data.receipt.amount_in_words), `Receipt contains amount in words: "${receiptJsonRes.data.receipt.amount_in_words}"`);
    assert(Boolean(receiptJsonRes.data.receipt.tax_breakdown), "Receipt includes GST tax breakdown");

    // 6b. Test Printable HTML receipt
    const receiptHtmlRes = await request(`/api/orders/${encodeURIComponent(testOrder.id)}/receipt?format=html`, { headers: authHeaders });
    assert(receiptHtmlRes.status === 200, "GET /api/orders/:id/receipt?format=html returns 200");
    assert(receiptHtmlRes.data.includes("TAX INVOICE / CASH RECEIPT"), "Receipt HTML contains Tax Invoice header");
    assert(receiptHtmlRes.data.includes(testOrder.id), "Receipt HTML contains real order ID");
    assert(receiptHtmlRes.data.includes("3025120612245599988"), "Receipt HTML contains FSSAI License number");
    assert(receiptHtmlRes.data.includes("Malegaon"), "Receipt HTML contains Malegaon origin");

    console.log("==================================================");
    console.log("🎉 ALL MONGODB ATLAS TESTS PASSED SUCCESSFULLY!");
    console.log("==================================================");

  } catch (err) {
    console.error("Test failure:", err);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.close();
    }
    await mongoose.disconnect();
  }
}

runMongoDBAtlasTests();
