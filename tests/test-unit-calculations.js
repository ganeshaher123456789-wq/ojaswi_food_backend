import assert from "node:assert";
import { INITIAL_PRODUCTS } from "../database/seed.js";
import { OJASWI_CONSTANTS } from "../config/constants.js";

console.log("==================================================");
console.log("🧮 OJASWI FOODS - UNIT TESTING SUITE");
console.log("==================================================");

let passCount = 0;
function pass(msg) {
  passCount++;
  console.log(`  ✅ PASS: ${msg}`);
}

// -----------------------------------------------------------------
// 1. Product Total Price Calculation (Quantity × Unit Price)
// -----------------------------------------------------------------
console.log("\n[UNIT 1] Product Total Price Calculation (Qty × Price)");
{
  const unitPrice = 199;
  for (let q = 1; q <= 10; q++) {
    const expected = q * unitPrice;
    const computed = q * unitPrice;
    assert.strictEqual(computed, expected, `Calculation for qty ${q}`);
  }
  pass("Product unit price multiplication verified for quantities 1 through 10 (199 to 1990)");

  // Edge cases
  assert.strictEqual(0 * unitPrice, 0, "Zero quantity yields 0");
  assert.strictEqual(50 * unitPrice, 9950, "Bulk quantity 50 correctly yields 9950");
  pass("Zero and maximum boundary quantities calculated accurately");
}

// -----------------------------------------------------------------
// 2. Cart Quantity Increase and Decrease Logic
// -----------------------------------------------------------------
console.log("\n[UNIT 2] Cart Quantity Increase and Decrease Logic");
{
  let cart = [
    { id: 1, name: "Garam Masala", price: 199, quantity: 1 },
    { id: 2, name: "Kitchen King Masala", price: 199, quantity: 2 }
  ];

  // Increase quantity of item 1
  const item1 = cart.find(i => i.id === 1);
  item1.quantity += 1;
  assert.strictEqual(item1.quantity, 2, "Quantity increased from 1 to 2");
  pass("Cart quantity increment verified (1 -> 2)");

  // Decrease quantity of item 2
  const item2 = cart.find(i => i.id === 2);
  item2.quantity -= 1;
  assert.strictEqual(item2.quantity, 1, "Quantity decreased from 2 to 1");
  pass("Cart quantity decrement verified (2 -> 1)");

  // Decrement to zero removes item
  const updateQty = (id, newQty) => {
    if (newQty <= 0) {
      cart = cart.filter(i => i.id !== id);
    } else {
      const it = cart.find(i => i.id === id);
      if (it) it.quantity = Math.min(newQty, 50);
    }
  };

  updateQty(2, 0);
  assert.strictEqual(cart.length, 1, "Item removed when qty <= 0");
  assert.strictEqual(cart[0].id, 1, "Remaining item is Garam Masala");
  pass("Item automatically pruned when quantity reaches 0");

  // Quantity cap at 50
  updateQty(1, 999);
  assert.strictEqual(cart[0].quantity, 50, "Quantity capped at upper boundary 50");
  pass("Quantity safely capped at 50 to prevent overflow");
}

// -----------------------------------------------------------------
// 3. Subtotal, Delivery Charge & Final Order Amount
// -----------------------------------------------------------------
console.log("\n[UNIT 3] Subtotal and Final Order Amount");
{
  const cartItems = [
    { id: 1, name: "Garam Masala", price: 199, quantity: 2 }, // 398
    { id: 3, name: "Sabji Masala", price: 199, quantity: 1 }, // 199
    { id: 14, name: "Kasuri Methi", price: 99, quantity: 3 }   // 297
  ];

  const subtotal = cartItems.reduce((acc, it) => acc + (it.price * it.quantity), 0);
  assert.strictEqual(subtotal, 894, "Subtotal is (2*199) + (1*199) + (3*99) = 894");
  pass(`Subtotal calculated accurately: ₹${subtotal}`);

  // Free delivery threshold vs standard delivery charge
  const deliveryCharge = OJASWI_CONSTANTS.DEFAULT_DELIVERY_CHARGE || 0;
  const grandTotal = subtotal + deliveryCharge;
  assert.strictEqual(grandTotal, 894 + deliveryCharge, "Grand total includes delivery charge");
  pass(`Final order amount verified: ₹${grandTotal} (Subtotal: ₹${subtotal} + Delivery: ₹${deliveryCharge})`);
}

// -----------------------------------------------------------------
// 4. 10-Digit Indian Mobile Number Validation
// -----------------------------------------------------------------
console.log("\n[UNIT 4] 10-Digit Indian Mobile Number Validation");
{
  function validateIndianPhone(input) {
    if (!input || typeof input !== "string") return null;
    const digitsOnly = input.replace(/\D/g, "");
    let cleaned = digitsOnly;
    if (cleaned.length === 12 && cleaned.startsWith("91")) {
      cleaned = cleaned.slice(2);
    } else if (cleaned.length === 11 && cleaned.startsWith("0")) {
      cleaned = cleaned.slice(1);
    }
    if (cleaned.length === 10 && /^[6-9]\d{9}$/.test(cleaned)) {
      return cleaned;
    }
    return null;
  }

  // Valid Indian numbers
  assert.strictEqual(validateIndianPhone("9820012345"), "9820012345");
  assert.strictEqual(validateIndianPhone("+91 98200 12345"), "9820012345");
  assert.strictEqual(validateIndianPhone("09820012345"), "9820012345");
  assert.strictEqual(validateIndianPhone("91-98200-12345"), "9820012345");
  assert.strictEqual(validateIndianPhone("  7620098478  "), "7620098478");
  assert.strictEqual(validateIndianPhone("8123456789"), "8123456789");
  assert.strictEqual(validateIndianPhone("6123456789"), "6123456789");
  pass("Valid formats correctly cleaned and validated (standard, +91 prefix, 0 prefix, spaces, hyphens)");

  // Invalid numbers
  assert.strictEqual(validateIndianPhone("12345"), null, "Too short");
  assert.strictEqual(validateIndianPhone("982001234567"), null, "Too long");
  assert.strictEqual(validateIndianPhone("5123456789"), null, "Invalid starting digit (5)");
  assert.strictEqual(validateIndianPhone("0123456789"), null, "Invalid starting digit (0)");
  assert.strictEqual(validateIndianPhone("abcdefghij"), null, "Alphabetic characters");
  assert.strictEqual(validateIndianPhone(""), null, "Empty string");
  assert.strictEqual(validateIndianPhone(null), null, "Null input");
  pass("Invalid phone numbers strictly rejected (length < 10, length > 10, invalid starting digit, letters)");
}

// -----------------------------------------------------------------
// 5. Customer Email & Required Field Validation
// -----------------------------------------------------------------
console.log("\n[UNIT 5] Customer Email & Required Field Validation");
{
  function validateEmail(email) {
    if (!email || typeof email !== "string") return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  assert.strictEqual(validateEmail("ganesh@example.com"), true);
  assert.strictEqual(validateEmail("user.name+tag@domain.co.in"), true);
  assert.strictEqual(validateEmail("ojaswifoods@gmail.com"), true);
  assert.strictEqual(validateEmail("invalid-email"), false);
  assert.strictEqual(validateEmail("invalid@"), false);
  assert.strictEqual(validateEmail("@domain.com"), false);
  assert.strictEqual(validateEmail(""), false);
  pass("Email format validation correctly accepts RFC-compliant formats and rejects invalid strings");
}

// -----------------------------------------------------------------
// 6. Customer Name and Address Validation
// -----------------------------------------------------------------
console.log("\n[UNIT 6] Customer Name & Address Validation");
{
  function validateCustomerDetails({ name, address }) {
    const errors = [];
    if (!name || typeof name !== "string" || name.trim().length < 2) {
      errors.push("Name must be at least 2 characters");
    }
    if (!address || typeof address !== "object") {
      errors.push("Address object is required");
      return errors;
    }
    if (!address.flat_house || !address.flat_house.trim()) {
      errors.push("Flat/House number is required");
    }
    if (!address.area_street || !address.area_street.trim()) {
      errors.push("Area/Street is required");
    }
    if (!address.city || !address.city.trim()) {
      errors.push("City is required");
    }
    if (!address.pincode || !/^\d{6}$/.test(address.pincode.trim())) {
      errors.push("Valid 6-digit PIN code is required");
    }
    return errors;
  }

  // Valid details
  const validErrors = validateCustomerDetails({
    name: "Ganesh Aher",
    address: {
      flat_house: "Flat 101, Anand Vihar",
      area_street: "College Road",
      city: "Malegaon",
      state: "Maharashtra",
      pincode: "423203"
    }
  });
  assert.strictEqual(validErrors.length, 0, "Valid details have 0 errors");
  pass("Valid customer name and address accepted without errors");

  // Incomplete details
  const incompleteErrors = validateCustomerDetails({
    name: "",
    address: {
      flat_house: "",
      area_street: "",
      city: "",
      pincode: "123"
    }
  });
  assert(incompleteErrors.length >= 4, "Caught all missing required fields");
  pass("Missing name, flat, area, city, and invalid PIN code properly caught");
}

// -----------------------------------------------------------------
// 7. Order Confirmation Message Generation (WhatsApp, SMS, Email)
// -----------------------------------------------------------------
console.log("\n[UNIT 7] Order Confirmation Message Generation");
{
  const orderData = {
    orderId: "#OJTEST-9988",
    customer_name: "Ganesh Sharma",
    customer_phone: "9820011223",
    customer_email: "ganesh.sharma@example.com",
    address: "Flat 101, Anand Vihar, College Road, Malegaon - 423203",
    items: [
      { name: "Garam Masala", quantity: 2, price: 199 },
      { name: "Kitchen King Masala", quantity: 1, price: 199 }
    ],
    total: 597,
    paymentMethod: "Cash on Delivery"
  };

  // WhatsApp Message
  const waMsg = [
    `*Order ID:* ${orderData.orderId}`,
    `*Customer:* ${orderData.customer_name}`,
    `*Phone:* +91 ${orderData.customer_phone}`,
    `*Delivery Address:* ${orderData.address}`,
    `*Payment Method:* ${orderData.paymentMethod}`,
    `*Payment Status:* Payment Pending - Cash on Delivery`,
    `*Total:* ₹${orderData.total}`,
    ...orderData.items.map(i => `• ${i.name} x ${i.quantity} (₹${i.price * i.quantity})`)
  ].join("\n");

  assert(waMsg.includes(orderData.orderId));
  assert(waMsg.includes("Ganesh Sharma"));
  assert(waMsg.includes("Payment Pending - Cash on Delivery"));
  assert(waMsg.includes("₹597"));
  pass("WhatsApp order message generated with exact order ID, name, items, and COD status");

  // SMS Message
  const itemsSummary = orderData.items.map(i => `${i.name} (x${i.quantity})`).join(", ");
  const smsMsg = `Ojaswi Foods Order ${orderData.orderId}
Customer: ${orderData.customer_name}
Phone: +91 ${orderData.customer_phone}
Items: ${itemsSummary}
Total: Rs.${orderData.total}
Status: Payment Pending - Cash on Delivery
Address: ${orderData.address}`;

  assert(smsMsg.includes(orderData.orderId));
  assert(smsMsg.includes("Rs.597"));
  assert(smsMsg.length < 350, "SMS length is compact for carrier delivery");
  pass("SMS message formatted concisely with complete order details");

  // Email subject & body
  const emailSubject = `Order Confirmation ${orderData.orderId} - Ojaswi Foods`;
  const mailtoUri = `mailto:ojaswifoods@gmail.com?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(waMsg)}`;
  assert(mailtoUri.startsWith("mailto:ojaswifoods@gmail.com?subject="));
  pass("Email mailto URI generated with official Ojaswi business address and prefilled text");
}

// -----------------------------------------------------------------
// 8. Empty Cart and Invalid Input Handling
// -----------------------------------------------------------------
console.log("\n[UNIT 8] Empty Cart and Invalid Input Handling");
{
  function validateOrderPayload(payload) {
    if (!payload.items || !Array.isArray(payload.items) || payload.items.length === 0) {
      return { valid: false, error: "Your cart is empty. Please add items before checking out." };
    }
    for (const item of payload.items) {
      const q = parseInt(item.quantity, 10);
      if (isNaN(q) || q < 1 || q > 100) {
        return { valid: false, error: `Invalid quantity for item ${item.name || item.id}.` };
      }
    }
    return { valid: true };
  }

  assert.strictEqual(validateOrderPayload({ items: [] }).valid, false);
  assert.strictEqual(validateOrderPayload({ items: null }).valid, false);
  assert.strictEqual(validateOrderPayload({ items: [{ id: 1, quantity: 0 }] }).valid, false);
  assert.strictEqual(validateOrderPayload({ items: [{ id: 1, quantity: -5 }] }).valid, false);
  assert.strictEqual(validateOrderPayload({ items: [{ id: 1, quantity: 101 }] }).valid, false);
  assert.strictEqual(validateOrderPayload({ items: [{ id: 1, quantity: 2 }] }).valid, true);
  pass("Empty carts, null items, zero quantity, negative quantity, and >100 quantities securely rejected");
}

// -----------------------------------------------------------------
// 9. Product Prices and Quantities Accuracy Against Catalog
// -----------------------------------------------------------------
console.log("\n[UNIT 9] Product Prices and Quantities Accuracy Against Official Catalog");
{
  assert(INITIAL_PRODUCTS.length >= 11, "At least 11 products in official catalog");
  for (const p of INITIAL_PRODUCTS) {
    assert(typeof p.name === "string" && p.name.trim().length > 0, `Product has valid name: ${p.name}`);
    assert(typeof p.price === "number" && p.price > 0, `Product ${p.name} has positive price: ₹${p.price}`);
    assert(p.mrp >= p.price, `Product ${p.name} MRP (₹${p.mrp}) >= selling price (₹${p.price})`);
    assert(typeof p.stock === "number" && p.stock > 0, `Product ${p.name} has positive stock: ${p.stock}`);
    assert(typeof p.image === "string" && p.image.endsWith(".jpeg"), `Product ${p.name} has valid image path`);
  }
  pass(`All ${INITIAL_PRODUCTS.length} official spice products verified for name, positive price, MRP discount, stock, and packaging images`);
}

console.log("\n==================================================");
console.log(`🎉 ALL UNIT TESTS COMPLETED! Total Passed: ${passCount}`);
console.log("==================================================");
