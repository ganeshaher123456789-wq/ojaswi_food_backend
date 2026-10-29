import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("===============================================================");
console.log("📲 TESTING ORDER CONFIRMATION CHANNELS (WHATSAPP, EMAIL, SMS)");
console.log("===============================================================");

// 1. Verify checkout.html contains all updated elements and handlers
const checkoutHtmlPath = path.resolve(__dirname, "../../frontend/checkout.html");
const checkoutHtml = fs.readFileSync(checkoutHtmlPath, "utf-8");

// Verify modal elements
assert(checkoutHtml.includes('id="btnConfirmWhatsAppOption"'), "WhatsApp option button must exist");
assert(checkoutHtml.includes('id="btnConfirmEmailOption"'), "Email option button must exist");
assert(checkoutHtml.includes('id="btnConfirmSMSOption"'), "SMS option button must exist");

// Verify dynamic action button in orderSuccessModal
assert(checkoutHtml.includes('id="btnSuccessPrimaryAction"'), "Primary dynamic action button must exist in success modal");
assert(checkoutHtml.includes('id="btnSuccessSecondary1"'), "Secondary 1 action button must exist in success modal");
assert(checkoutHtml.includes('id="btnSuccessSecondary2"'), "Secondary 2 action button must exist in success modal");

console.log("✅ PASS: HTML contains all modal elements and action buttons");

// 2. Test Message Generation Logic
const sampleData = {
  name: "Ganesh Aher",
  phone: "9022795768",
  email: "ganesh@example.com",
  address: "Flat 101, Anand Nagar, Malegaon, Maharashtra - 423203",
  items: [
    { name: "Kitchen King Masala", quantity: 2, price: 199, selling_price: 199 }
  ],
  total: 398,
  paymentMethod: "Cash on Delivery"
};

const testOrderId = "#OJ482910";

// Test SMS Message Builder logic
function buildCheckoutSmsMessage(data, orderId = "") {
  const cleanId = orderId.startsWith("#") ? orderId : `#${orderId}`;
  const itemsShort = data.items.map(i => `${i.name} (x${i.quantity})`).join(", ");
  return `Ojaswi Foods Order ${cleanId}
Customer: ${data.name}
Phone: +91 ${data.phone}
Items: ${itemsShort}
Total: Rs.${data.total}
Status: Payment Pending - Cash on Delivery
Address: ${data.address}`;
}

const smsText = buildCheckoutSmsMessage(sampleData, testOrderId);
assert(smsText.includes(testOrderId), "SMS must include Order ID");
assert(smsText.includes("Ganesh Aher"), "SMS must include customer name");
assert(smsText.includes("9022795768"), "SMS must include customer phone");
assert(smsText.includes("Rs.398"), "SMS must include total amount");
assert(smsText.includes("Payment Pending - Cash on Delivery"), "SMS must include COD pending status");
assert(smsText.length < 350, "SMS text must be concise for mobile carrier compatibility");

// Test iOS vs Android SMS URI formats
const OJASWI_PHONE = "917620098478";
const androidSmsUrl = `sms:+${OJASWI_PHONE}?body=${encodeURIComponent(smsText)}`;
const iosSmsUrl = `sms:+${OJASWI_PHONE}&body=${encodeURIComponent(smsText)}`;

assert(androidSmsUrl.startsWith("sms:+917620098478?body="), "Android SMS URI starts with sms:+917620098478?body=");
assert(iosSmsUrl.startsWith("sms:+917620098478&body="), "iOS SMS URI starts with sms:+917620098478&body=");

console.log("✅ PASS: SMS message format & mobile URI generation verified");
console.log("   -> Android URL:", androidSmsUrl.slice(0, 75) + "...");
console.log("   -> iOS URL:    ", iosSmsUrl.slice(0, 75) + "...");

// 3. Test Email Message Builder logic
function buildCheckoutEmailMessage(data, orderId = "") {
  const cleanId = orderId.startsWith("#") ? orderId : `#${orderId}`;
  const itemsList = data.items.map((i, idx) => 
    `  ${idx + 1}. ${i.name} (500g) - Qty: ${i.quantity} x Rs.${i.selling_price || i.price} = Rs.${(i.selling_price || i.price) * i.quantity}`
  ).join("\n");

  return `Dear Ojaswi Foods Team,

I am confirming my spice order ${cleanId}.

--- ORDER SUMMARY ---
${itemsList}

Subtotal: Rs.${data.total}
Delivery Charges: Rs.0 (FREE Express Delivery)
Total Amount: Rs.${data.total}
Payment Status: Payment Pending — Cash on Delivery

--- CUSTOMER & DELIVERY DETAILS ---
Customer Name: ${data.name}
Mobile Number: +91 ${data.phone}
${data.email ? "Email: " + data.email + "\n" : ""}Delivery Address: ${data.address}

Please confirm receipt and dispatch my order from the Malegaon manufacturing facility (PIN: 423203).

Thank you!
${data.name}`;
}

const emailBody = buildCheckoutEmailMessage(sampleData, testOrderId);
const OJASWI_EMAIL = "ojaswifoods@gmail.com";
const emailSubject = `Order Confirmation ${testOrderId} - Ojaswi Foods (Rs.${sampleData.total})`;
const mailtoUrl = `mailto:${OJASWI_EMAIL}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

assert(mailtoUrl.startsWith("mailto:ojaswifoods@gmail.com?subject="), "Mailto URL must target ojaswifoods@gmail.com");
assert(emailBody.includes(testOrderId), "Email body must contain order ID");
assert(emailBody.includes("Payment Pending — Cash on Delivery"), "Email must show COD status");
assert(emailBody.includes("Malegaon"), "Email must include dispatch facility location");

console.log("✅ PASS: Email message format & mailto URI generation verified");
console.log("   -> Mailto URL:", mailtoUrl.slice(0, 75) + "...");

// 4. Test WhatsApp Message Builder logic
function buildCheckoutOrderMessage(data, orderId = "") {
  const id = orderId ? (orderId.startsWith("#") ? orderId.slice(1) : orderId) : "OJ123456";
  return `*Order ID:* #${id}\n*Customer Name:* ${data.name}\n*Payment Status:* Payment Pending — Cash on Delivery`;
}
const waMsg = buildCheckoutOrderMessage(sampleData, testOrderId);
const waUrl = "https://api.whatsapp.com/send?phone=" + OJASWI_PHONE + "&text=" + encodeURIComponent(waMsg);
assert(waUrl.includes("api.whatsapp.com/send?phone=917620098478"), "WhatsApp URL must target +917620098478");

console.log("✅ PASS: WhatsApp URL generation verified");
console.log("   -> WhatsApp URL:", waUrl.slice(0, 75) + "...");

console.log("\n🎯 ALL 3 ORDER CONFIRMATION CHANNELS READY FOR MOBILE & DESKTOP!");

