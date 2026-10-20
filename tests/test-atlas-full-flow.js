import mongoose from "mongoose";
import { ENV } from "../config/env.js";
import { User, Order, Product, Address } from "../models/index.js";

const BASE_URL = "http://localhost:5000";

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    testsPassed++;
  } else {
    console.error(`  ❌ FAILED: ${message}`);
    testsFailed++;
  }
}

async function run() {
  console.log("==================================================");
  console.log("🧪 TESTING FULL MONGODB ATLAS INTEGRATION & ISOLATION");
  console.log("==================================================");

  // Connect to MongoDB Atlas for direct DB verification
  console.log("Connecting directly to MongoDB Atlas...");
  await mongoose.connect(ENV.MONGODB_URI, { dbName: "ojaswi" });
  console.log("✓ Connected to MongoDB Atlas cluster 'Cluster0' db: ojaswi\n");

  const ts = Date.now().toString().slice(-6);
  const userAEmail = `customerA_${ts}@ojaswitest.com`;
  const userAPhone = `98230${ts.slice(-5)}`;
  const userAName = `Aarav Sharma ${ts}`;
  const userAPassword = "Password123!";

  const userBEmail = `customerB_${ts}@ojaswitest.com`;
  const userBPhone = `98231${ts.slice(-5)}`;
  const userBName = `Priya Patil ${ts}`;
  const userBPassword = "Password123!";

  let tokenA = "";
  let userAId = null;
  let orderIdA = "";

  let tokenB = "";
  let userBId = null;
  let orderIdB = "";

  let adminToken = "";

  try {
    // ----------------------------------------------------
    // STEP 1: Register Customer A
    // ----------------------------------------------------
    console.log("--- 1. Registering Customer A ---");
    const regARes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: userAName,
        phone: userAPhone,
        email: userAEmail,
        password: userAPassword
      })
    });
    const regAData = await regARes.json();
    assert(regAData.success === true, `Customer A registered successfully (${userAName})`);
    assert(!!regAData.token, "Customer A received JWT token");
    tokenA = regAData.token;
    userAId = regAData.user.id;

    // Verify Customer A in MongoDB Atlas
    const mongoUserA = await User.findOne({ id: userAId }).lean();
    assert(!!mongoUserA, "Customer A record saved in MongoDB Atlas 'users' collection");
    assert(mongoUserA.name === userAName, `Customer A name in Atlas is ${userAName}`);
    assert(mongoUserA.phone === userAPhone, `Customer A phone in Atlas is ${userAPhone}`);
    assert(mongoUserA.email && mongoUserA.email.toLowerCase() === userAEmail.toLowerCase(), `Customer A email in Atlas is ${mongoUserA.email}`);
    assert(mongoUserA.password_hash && mongoUserA.password_hash !== userAPassword, "Password securely hashed with bcrypt (never plain-text)");

    // ----------------------------------------------------
    // STEP 2: Login Customer A
    // ----------------------------------------------------
    console.log("\n--- 2. Logging in Customer A ---");
    const loginARes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: userAPhone,
        password: userAPassword
      })
    });
    const loginAData = await loginARes.json();
    assert(loginAData.success === true, "Customer A login successful with mobile and password");
    assert(loginAData.user.id === userAId, "Login authenticated the correct registered customer ID");

    // ----------------------------------------------------
    // STEP 3: Update Customer A Profile & Delivery Address
    // ----------------------------------------------------
    console.log("\n--- 3. Updating Customer A Profile & Address ---");
    const updateARes = await fetch(`${BASE_URL}/api/account`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        name: `${userAName} Updated`,
        email: userAEmail,
        phone: userAPhone,
        city: "Pune",
        state: "Maharashtra",
        pincode: "411001",
        delivery_address: {
          flat_house: "Flat 101, Shanti Heights",
          area_street: "FC Road, Deccan",
          city: "Pune",
          state: "Maharashtra",
          pincode: "411001"
        }
      })
    });
    const updateAData = await updateARes.json();
    assert(updateAData.success === true, "Customer A profile updated successfully");

    // Verify update in MongoDB Atlas
    const mongoUserAUpdated = await User.findOne({ id: userAId }).lean();
    assert(mongoUserAUpdated.city === "Pune", "Customer A city updated in MongoDB Atlas to 'Pune'");
    assert(mongoUserAUpdated.pincode === "411001", "Customer A pincode updated in MongoDB Atlas to '411001'");
    assert(!!mongoUserAUpdated.delivery_address, "Customer A delivery_address subdocument exists in MongoDB Atlas");

    // ----------------------------------------------------
    // STEP 4: Place Order for Customer A
    // ----------------------------------------------------
    console.log("\n--- 4. Placing Order for Customer A ---");
    const orderARes = await fetch(`${BASE_URL}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        customer_name: userAName,
        customer_phone: userAPhone,
        customer_email: userAEmail,
        delivery_address: {
          flat_house: "Flat 101, Shanti Heights",
          area_street: "FC Road, Deccan",
          city: "Pune",
          state: "Maharashtra",
          pincode: "411001"
        },
        items: [
          { productId: 1, quantity: 2 }
        ],
        payment_method: "Cash on Delivery",
        notes: "Please deliver between 4 PM and 6 PM"
      })
    });
    const orderAData = await orderARes.json();
    assert(orderAData.success === true, `Customer A order created: ${orderAData.orderId}`);
    orderIdA = orderAData.orderId;

    // Verify Order A in MongoDB Atlas
    const mongoOrderA = await Order.findOne({ id: orderIdA }).lean();
    assert(!!mongoOrderA, `Order A (${orderIdA}) found directly in MongoDB Atlas 'orders' collection`);
    assert(mongoOrderA.user_id === userAId, "Order A in Atlas is correctly associated with Customer A's ID");
    assert(mongoOrderA.customer_phone === userAPhone, "Order A has customer phone saved in Atlas");
    assert(mongoOrderA.items && mongoOrderA.items.length === 1, "Order A has item details stored in Atlas");
    assert(mongoOrderA.items[0].product_name.includes("Masala"), `Order item product name in Atlas: ${mongoOrderA.items[0].product_name}`);
    assert(mongoOrderA.items[0].quantity === 2, "Order item quantity in Atlas is 2");
    assert(mongoOrderA.total_amount > 0, `Order total amount in Atlas is ₹${mongoOrderA.total_amount}`);
    assert(mongoOrderA.delivery_address && mongoOrderA.delivery_address.city === "Pune", "Order delivery address city in Atlas is Pune");

    // Verify Customer A stats updated in MongoDB Atlas
    const mongoUserAWithOrder = await User.findOne({ id: userAId }).lean();
    assert(mongoUserAWithOrder.total_orders >= 1, `Customer A total_orders incremented to ${mongoUserAWithOrder.total_orders} in Atlas`);
    assert(mongoUserAWithOrder.last_order_id === orderIdA, "Customer A last_order_id updated in Atlas");

    // ----------------------------------------------------
    // STEP 5: Register Customer B & Place Order
    // ----------------------------------------------------
    console.log("\n--- 5. Registering Customer B & Placing Order B ---");
    const regBRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: userBName,
        phone: userBPhone,
        email: userBEmail,
        password: userBPassword
      })
    });
    const regBData = await regBRes.json();
    assert(regBData.success === true, `Customer B registered successfully (${userBName})`);
    tokenB = regBData.token;
    userBId = regBData.user.id;
    assert(userBId !== userAId, "Customer B has a distinct unique customer ID");

    const orderBRes = await fetch(`${BASE_URL}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${tokenB}`
      },
      body: JSON.stringify({
        customer_name: userBName,
        customer_phone: userBPhone,
        customer_email: userBEmail,
        delivery_address: {
          flat_house: "House 55, Shivaji Chowk",
          area_street: "College Road",
          city: "Nashik",
          state: "Maharashtra",
          pincode: "422001"
        },
        items: [
          { productId: 2, quantity: 1 }
        ],
        payment_method: "Cash on Delivery"
      })
    });
    const orderBData = await orderBRes.json();
    assert(orderBData.success === true, `Customer B order created: ${orderBData.orderId}`);
    orderIdB = orderBData.orderId;

    const mongoOrderB = await Order.findOne({ id: orderIdB }).lean();
    assert(!!mongoOrderB, "Order B saved directly in MongoDB Atlas");
    assert(mongoOrderB.user_id === userBId, "Order B associated with Customer B ID");

    // ----------------------------------------------------
    // STEP 6: Privacy & Data Isolation Verification
    // ----------------------------------------------------
    console.log("\n--- 6. Verifying Customer Privacy & Order History Isolation ---");
    // Customer A queries /api/orders
    const ordersARes = await fetch(`${BASE_URL}/api/orders`, {
      headers: { "Authorization": `Bearer ${tokenA}` }
    });
    const ordersAData = await ordersARes.json();
    assert(ordersAData.success === true, "Customer A fetched orders");
    const ordersAIds = ordersAData.orders.map(o => o.id);
    assert(ordersAIds.includes(orderIdA), "Customer A sees their own Order A");
    assert(!ordersAIds.includes(orderIdB), "PRIVACY: Customer A CANNOT see Customer B's Order B");

    // Customer B queries /api/orders
    const ordersBRes = await fetch(`${BASE_URL}/api/orders`, {
      headers: { "Authorization": `Bearer ${tokenB}` }
    });
    const ordersBData = await ordersBRes.json();
    assert(ordersBData.success === true, "Customer B fetched orders");
    const ordersBIds = ordersBData.orders.map(o => o.id);
    assert(ordersBIds.includes(orderIdB), "Customer B sees their own Order B");
    assert(!ordersBIds.includes(orderIdA), "PRIVACY: Customer B CANNOT see Customer A's Order A");

    // Customer A attempts to view Order B receipt or order details directly
    const crossOrderRes = await fetch(`${BASE_URL}/api/orders/${encodeURIComponent(orderIdB)}`, {
      headers: { "Authorization": `Bearer ${tokenA}` }
    });
    assert(crossOrderRes.status === 403, "PRIVACY: Accessing another customer's order directly returns 403 Forbidden");

    // Unauthenticated request to /api/orders
    const unauthOrdersRes = await fetch(`${BASE_URL}/api/orders`);
    const unauthOrdersData = await unauthOrdersRes.json();
    assert(unauthOrdersData.requiresAuth === true && unauthOrdersData.orders.length === 0, "Unauthenticated visitors cannot view any customer orders");

    // ----------------------------------------------------
    // STEP 7: Owner/Admin Dashboard Verification
    // ----------------------------------------------------
    console.log("\n--- 7. Verifying Owner/Admin Dashboard ---");
    const adminLoginRes = await fetch(`${BASE_URL}/api/auth/admin-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "admin",
        password: ENV.ADMIN_DEFAULT_PASSWORD || "OjaswiAdmin@2026"
      })
    });
    const adminLoginData = await adminLoginRes.json();
    assert(adminLoginData.success === true, "Admin authenticated successfully");
    adminToken = adminLoginData.token;

    // Check Dashboard KPIs
    const dashRes = await fetch(`${BASE_URL}/api/admin/dashboard`, {
      headers: { "Authorization": `Bearer ${adminToken}` }
    });
    const dashData = await dashRes.json();
    assert(dashData.success === true, "Admin dashboard KPIs retrieved");
    assert(dashData.stats.totalCustomers >= 2, `Total registered customers in Atlas: ${dashData.stats.totalCustomers}`);
    assert(dashData.stats.totalOrders >= 2, `Total orders in Atlas: ${dashData.stats.totalOrders}`);
    assert(dashData.stats.totalRevenue > 0, `Total revenue calculated: ₹${dashData.stats.totalRevenue}`);

    // Check Admin Orders List
    const adminOrdersRes = await fetch(`${BASE_URL}/api/admin/orders`, {
      headers: { "Authorization": `Bearer ${adminToken}` }
    });
    const adminOrdersData = await adminOrdersRes.json();
    assert(adminOrdersData.success === true, "Admin orders list retrieved");
    const adminOrderIds = adminOrdersData.orders.map(o => o.id);
    assert(adminOrderIds.includes(orderIdA), "Admin orders list includes Order A");
    assert(adminOrderIds.includes(orderIdB), "Admin orders list includes Order B");

    // Check Admin Single Order Details
    const adminSingleOrderRes = await fetch(`${BASE_URL}/api/admin/orders/${encodeURIComponent(orderIdA)}`, {
      headers: { "Authorization": `Bearer ${adminToken}` }
    });
    const adminSingleOrderData = await adminSingleOrderRes.json();
    assert(adminSingleOrderData.success === true, "Admin fetched single order details");
    assert(adminSingleOrderData.order.customer_name === userAName, "Order details show customer name");
    assert(adminSingleOrderData.order.delivery_address.city === "Pune", "Order details show delivery address");
    assert(adminSingleOrderData.order.items.length >= 1, "Order details show product items");

    // Check Admin Customer Directory
    const adminCustRes = await fetch(`${BASE_URL}/api/admin/customers`, {
      headers: { "Authorization": `Bearer ${adminToken}` }
    });
    const adminCustData = await adminCustRes.json();
    assert(adminCustData.success === true, "Admin customer directory retrieved");
    const foundA = adminCustData.customers.find(c => c.id === userAId);
    assert(!!foundA, "Customer A found in Admin Customer Directory");
    assert(foundA.name === `${userAName} Updated`, "Customer A updated name displayed");
    assert(foundA.phone === userAPhone, "Customer A phone displayed");

    // Check Individual Customer Order History (/api/admin/customers/:id)
    const custHistoryRes = await fetch(`${BASE_URL}/api/admin/customers/${userAId}`, {
      headers: { "Authorization": `Bearer ${adminToken}` }
    });
    const custHistoryData = await custHistoryRes.json();
    assert(custHistoryData.success === true, "Admin retrieved Customer A individual order history");
    assert(custHistoryData.orders.some(o => o.id === orderIdA), "Customer A history contains Order A");
    assert(!custHistoryData.orders.some(o => o.id === orderIdB), "Customer A history does NOT contain Order B");

    // ----------------------------------------------------
    // STEP 8: Update Order Status & Verify in MongoDB Atlas
    // ----------------------------------------------------
    console.log("\n--- 8. Updating Order Status & Verifying in Atlas ---");
    const statusUpdateRes = await fetch(`${BASE_URL}/api/admin/orders/${encodeURIComponent(orderIdA)}/status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        status: "Shipped",
        tracking_note: "Dispatched from Malegaon via India Post Speed Post"
      })
    });
    const statusUpdateData = await statusUpdateRes.json();
    assert(statusUpdateData.success === true, `Order A status updated to Shipped`);

    // Verify in MongoDB Atlas directly
    const updatedMongoOrderA = await Order.findOne({ id: orderIdA }).lean();
    assert(updatedMongoOrderA.order_status === "Shipped", "Order A status in MongoDB Atlas is 'Shipped'");
    assert(!!updatedMongoOrderA.dispatched_at, "Order A dispatched_at timestamp recorded in Atlas");
    assert(updatedMongoOrderA.tracking_note.includes("Malegaon"), "Order A tracking note stored in Atlas");

    // Update Order B to Delivered
    const statusDeliveredRes = await fetch(`${BASE_URL}/api/admin/orders/${encodeURIComponent(orderIdB)}/status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        status: "Delivered"
      })
    });
    const statusDeliveredData = await statusDeliveredRes.json();
    assert(statusDeliveredData.success === true, "Order B status updated to Delivered");

    const updatedMongoOrderB = await Order.findOne({ id: orderIdB }).lean();
    assert(updatedMongoOrderB.order_status === "Delivered", "Order B status in MongoDB Atlas is 'Delivered'");
    assert(updatedMongoOrderB.payment_status === "Paid", "COD Order B payment_status automatically updated to 'Paid' upon delivery");

    // ----------------------------------------------------
    // STEP 9: Idempotency (Duplicate Order Prevention)
    // ----------------------------------------------------
    console.log("\n--- 9. Testing Idempotency & Duplicate Order Prevention ---");
    const retryOrderRes = await fetch(`${BASE_URL}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        customer_name: userAName,
        customer_phone: userAPhone,
        customer_email: userAEmail,
        delivery_address: {
          flat_house: "Flat 101, Shanti Heights",
          area_street: "FC Road, Deccan",
          city: "Pune",
          state: "Maharashtra",
          pincode: "411001"
        },
        items: [
          { productId: 1, quantity: 2 }
        ],
        payment_method: "Cash on Delivery"
      })
    });
    const retryOrderData = await retryOrderRes.json();
    assert(retryOrderData.success === true, "Retry request handled gracefully");
    assert(retryOrderData.orderId === orderIdA, `Duplicate order prevented! Returned existing order ${orderIdA}`);

  } catch (err) {
    console.error("Test execution error:", err);
    testsFailed++;
  } finally {
    await mongoose.disconnect();
  }

  console.log("\n==================================================");
  console.log(`TEST SUMMARY: ${testsPassed} PASSED, ${testsFailed} FAILED`);
  console.log("==================================================");

  if (testsFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run();
