import { generateToken } from "../middleware/auth.js";
import { db } from "../config/db.js";

async function verify() {
  console.log("[Privacy Test] Verifying customer history isolation...");
  
  // Insert user A
  const phoneA = "98" + Date.now().toString().slice(-8);
  const resUserA = await db.run("INSERT INTO users (name, phone, role) VALUES (?, ?, ?)", ["Privacy A", "+91" + phoneA, "customer"]);
  const userA = { id: resUserA.lastInsertRowid, role: "customer" };
  const tokenA = generateToken(userA);

  // Insert user B
  const phoneB = "97" + Date.now().toString().slice(-8);
  const resUserB = await db.run("INSERT INTO users (name, phone, role) VALUES (?, ?, ?)", ["Privacy B", "+91" + phoneB, "customer"]);
  const userB = { id: resUserB.lastInsertRowid, role: "customer" };
  const tokenB = generateToken(userB);

  // Order for A
  const orderIdA = "OJ" + Date.now().toString(16).slice(-6).toUpperCase();
  await db.run("INSERT INTO orders (id, user_id, customer_name, customer_phone, subtotal, total_amount, payment_method, order_status, delivery_address_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [orderIdA, userA.id, "Privacy A", "+91" + phoneA, 199, 199, "cod", "Pending", "{}"]);

  // Order for B
  const orderIdB = "OJ" + (Date.now() + 1).toString(16).slice(-6).toUpperCase();
  await db.run("INSERT INTO orders (id, user_id, customer_name, customer_phone, subtotal, total_amount, payment_method, order_status, delivery_address_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [orderIdB, userB.id, "Privacy B", "+91" + phoneB, 399, 399, "cod", "Pending", "{}"]);

  // Fetch as A
  const resA = await fetch("http://127.0.0.1:5000/api/orders", {
    headers: { "Authorization": "Bearer " + tokenA }
  });
  const dataA = await resA.json();
  const aSeesOwn = dataA.orders.some(o => o.id === orderIdA);
  const aSeesB = dataA.orders.some(o => o.id === orderIdB);

  // Fetch as B
  const resB = await fetch("http://127.0.0.1:5000/api/orders", {
    headers: { "Authorization": "Bearer " + tokenB }
  });
  const dataB = await resB.json();
  const bSeesOwn = dataB.orders.some(o => o.id === orderIdB);
  const bSeesA = dataB.orders.some(o => o.id === orderIdA);

  // A attempts to access B order
  const resAB = await fetch("http://127.0.0.1:5000/api/orders/" + orderIdB, {
    headers: { "Authorization": "Bearer " + tokenA }
  });

  // Unauthenticated user fetches /api/orders
  const resAnon = await fetch("http://127.0.0.1:5000/api/orders");
  const dataAnon = await resAnon.json();

  console.log("User A sees only own order:", aSeesOwn && !aSeesB);
  console.log("User B sees only own order:", bSeesOwn && !bSeesA);
  console.log("User A blocked from User B order (403):", resAB.status === 403);
  console.log("Unauthenticated request returns 0 orders:", dataAnon.orders && dataAnon.orders.length === 0);

  if (aSeesOwn && !aSeesB && bSeesOwn && !bSeesA && resAB.status === 403 && dataAnon.orders.length === 0) {
    console.log("✅ ALL PRIVACY & ISOLATION CHECKS PASSED PERFECTLY!");
    process.exit(0);
  } else {
    console.error("❌ PRIVACY VERIFICATION: FAILED");
    process.exit(1);
  }
}

verify();
