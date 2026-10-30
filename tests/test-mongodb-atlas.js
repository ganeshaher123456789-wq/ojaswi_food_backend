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

    // 3. Verify Collections & Test Direct MongoDB Atlas CRUD Operations
    const userCount = await User.countDocuments();
    const productCount = await Product.countDocuments();
    const categoryCount = await Category.countDocuments();
    const orderCount = await Order.countDocuments();

    console.log(`>> MongoDB Atlas Document Counts:`);
    console.log(`   - Users:         ${userCount}`);
    console.log(`   - Products:      ${productCount}`);
    console.log(`   - Categories:    ${categoryCount}`);
    console.log(`   - Orders:        ${orderCount}`);

    // CRUD Operation Test 1: Insert test document into MongoDB Atlas
    const testAtlasUserId = 999900 + Math.floor(Math.random() * 999);
    const testUserEmail = `atlas.test.${Date.now()}@ojaswifoods.com`;
    const insertedUser = await User.create({
      id: testAtlasUserId,
      email: testUserEmail,
      phone: `99${Date.now().toString().slice(-8)}`,
      name: "Atlas Verification User",
      role: "customer"
    });
    assert(Boolean(insertedUser._id), "MongoDB Atlas successfully inserted document with _id");

    // CRUD Operation Test 2: Retrieval from MongoDB Atlas
    const retrievedUser = await User.findOne({ id: testAtlasUserId }).lean();
    assert(retrievedUser && retrievedUser.email === testUserEmail, "MongoDB Atlas successfully retrieved document by index");

    // CRUD Operation Test 3: Updating document in MongoDB Atlas
    const updatedUser = await User.findOneAndUpdate(
      { id: testAtlasUserId },
      { name: "Atlas Verified Customer Updated" },
      { returnDocument: "after" }
    ).lean();
    assert(updatedUser && updatedUser.name === "Atlas Verified Customer Updated", "MongoDB Atlas successfully updated document");

    // CRUD Operation Test 4: Schema constraints & duplicate unique index prevention
    const uniqueOrderId = `#OJ-TEST-DUP-${Date.now()}`;
    await Order.create({
      id: uniqueOrderId,
      customer_name: "Test Unique",
      customer_phone: "9876543210",
      total_amount: 199,
      subtotal: 199,
      payment_method: "Cash on Delivery",
      items: [{ product_id: 1, product_name: "Garam Masala", quantity: 1, unit_price: 199, total_price: 199 }]
    });

    let duplicateCaught = false;
    try {
      await Order.create({
        id: uniqueOrderId, // duplicate unique Order ID
        customer_name: "Duplicate Customer",
        customer_phone: "9123456789",
        total_amount: 199,
        subtotal: 199,
        payment_method: "Cash on Delivery",
        items: [{ product_id: 1, product_name: "Garam Masala", quantity: 1, unit_price: 199, total_price: 199 }]
      });
    } catch (e) {
      duplicateCaught = true;
    }
    assert(duplicateCaught === true, "MongoDB Atlas unique index correctly prevented duplicate document insertion");
    await Order.deleteOne({ id: uniqueOrderId });

    // CRUD Operation Test 5: Cleanup test document
    await User.deleteOne({ id: testAtlasUserId });
    const checkDeleted = await User.findOne({ id: testAtlasUserId }).lean();
    assert(!checkDeleted, "MongoDB Atlas successfully deleted test document");

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
    let testOrder = await Order.findOne({ id: { $exists: true } }).lean();
    let isTestOrderCreated = false;
    if (!testOrder) {
      const generatedOrderId = `#OJTEST-${Date.now()}`;
      testOrder = await Order.create({
        id: generatedOrderId,
        user_id: 1,
        customer_name: "Ganesh Sharma",
        customer_phone: "9820011223",
        customer_email: "ganesh.sharma@ojaswifoods.com",
        delivery_address_json: JSON.stringify({
          flat_house: "Flat 101, Anand Vihar",
          area_street: "College Road",
          city: "Malegaon",
          state: "Maharashtra",
          pincode: "423203"
        }),
        total_amount: 398,
        payment_method: "Cash on Delivery",
        payment_status: "Payment Pending — Cash on Delivery",
        order_status: "Confirmed (Pending Dispatch)",
        items: [
          {
            product_id: 1,
            product_name: "Garam Masala",
            quantity: 2,
            unit_price: 199,
            total_price: 398
          }
        ]
      });
      isTestOrderCreated = true;
    }
    assert(Boolean(testOrder), `Active order in MongoDB Atlas: ${testOrder?.id}`);

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

    // Clean up test order if created during test
    if (isTestOrderCreated) {
      await Order.deleteOne({ id: testOrder.id });
    }

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
