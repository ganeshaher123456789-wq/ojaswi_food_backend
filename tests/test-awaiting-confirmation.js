import db from "../config/db.js";

async function runTest() {
  console.log("Starting order confirmation status test...");
  const testOrderId = "#OJTEST_CONFIRM_FLOW";

  try {
    // 1. Clean up old test data if present
    await db.run("DELETE FROM order_items WHERE order_id = $1", [testOrderId]);
    await db.run("DELETE FROM orders WHERE id = $1", [testOrderId]);

    // 2. Insert test order in 'Awaiting Confirmation' state
    const addressJson = JSON.stringify({
      flat_house: "jhfjtffhrf",
      area_street: "fjgjgjg",
      city: "Malegaon",
      state: "Maharashtra",
      pincode: "423203"
    });

    await db.run(
      `INSERT INTO orders (id, customer_name, customer_phone, subtotal, delivery_charge, discount_amount, total_amount, payment_method, payment_status, order_status, confirmation_status, preferred_channel, delivery_address_json)
       VALUES ($1, $2, $3, $4, $5, 0, $6, 'Cash on Delivery', 'CASH ON DELIVERY — PAYMENT PENDING', 'Awaiting Confirmation', 'Awaiting Customer Message / Confirmation', 'whatsapp', $7)`,
      [testOrderId, "Khan Testing", "9022795768", 199, 0, 199, addressJson]
    );

    const initialOrder = await db.get("SELECT * FROM orders WHERE id = $1", [testOrderId]);
    console.log("✓ Initial Order Placed:");
    console.log("  Order ID:", initialOrder.id);
    console.log("  Order Status:", initialOrder.order_status);
    console.log("  Confirmation Status:", initialOrder.confirmation_status);
    console.log("  Payment Status:", initialOrder.payment_status);

    if (initialOrder.order_status !== "Awaiting Confirmation") {
      throw new Error(`Expected order_status 'Awaiting Confirmation', got '${initialOrder.order_status}'`);
    }

    if (initialOrder.payment_status !== "CASH ON DELIVERY — PAYMENT PENDING") {
      throw new Error(`Expected payment_status 'CASH ON DELIVERY — PAYMENT PENDING', got '${initialOrder.payment_status}'`);
    }

    // 3. Simulate customer clicking "I Have Sent the Message — Confirm Order"
    const confirmedTime = new Date().toISOString();
    await db.run(
      `UPDATE orders 
       SET order_status = $1, confirmation_status = $2, confirmed_at = $3, payment_status = $4
       WHERE id = $5`,
      ["Confirmed (Pending Dispatch)", "Confirmed by Customer", confirmedTime, "CASH ON DELIVERY — PAYMENT PENDING", testOrderId]
    );

    const updatedOrder = await db.get("SELECT * FROM orders WHERE id = $1", [testOrderId]);
    console.log("✓ After Customer Explicit Confirmation:");
    console.log("  Order ID:", updatedOrder.id);
    console.log("  Order Status:", updatedOrder.order_status);
    console.log("  Confirmation Status:", updatedOrder.confirmation_status);
    console.log("  Payment Status:", updatedOrder.payment_status);
    console.log("  Confirmed At:", updatedOrder.confirmed_at);

    if (updatedOrder.order_status !== "Confirmed (Pending Dispatch)") {
      throw new Error(`Expected order_status 'Confirmed (Pending Dispatch)', got '${updatedOrder.order_status}'`);
    }
    if (updatedOrder.confirmation_status !== "Confirmed by Customer") {
      throw new Error(`Expected confirmation_status 'Confirmed by Customer', got '${updatedOrder.confirmation_status}'`);
    }

    // 4. Clean up test record
    await db.run("DELETE FROM orders WHERE id = $1", [testOrderId]);
    console.log("✓ Test passed cleanly!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Test failed:", err);
    process.exit(1);
  }
}

runTest();
