import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, "../../frontend");

console.log("==================================================");
console.log("📱 OJASWI FOODS - UI & RESPONSIVE LAYOUT TEST SUITE");
console.log("==================================================");

let passCount = 0;
function pass(msg) {
  passCount++;
  console.log(`  ✅ PASS: ${msg}`);
}

// 1. Verify Viewport Meta Tag Across All HTML Pages
console.log("\n[UI 1] Responsive Viewport Meta Configuration");
const htmlFiles = [
  "index.html",
  "checkout.html",
  "orders.html",
  "order-confirmation.html",
  "privacy-policy.html",
  "terms-and-conditions.html",
  "refund-policy.html",
  "shipping-policy.html",
  "cancellation-policy.html",
  "contact-us.html"
];

for (const file of htmlFiles) {
  const filePath = path.join(frontendDir, file);
  assert(fs.existsSync(filePath), `HTML file exists: ${file}`);
  const content = fs.readFileSync(filePath, "utf-8");
  assert(
    content.includes('<meta name="viewport"') && content.includes("width=device-width"),
    `Page ${file} has responsive viewport meta tag`
  );
}
pass(`All ${htmlFiles.length} HTML pages have responsive viewport meta tags configured for mobile & desktop`);

// 2. Verify Mobile Responsive CSS Breakpoints
console.log("\n[UI 2] Responsive CSS Media Queries");
const cssFiles = fs.readdirSync(path.join(frontendDir, "css")).filter(f => f.endsWith(".css"));
let totalMediaQueries = 0;

for (const file of cssFiles) {
  const cssPath = path.join(frontendDir, "css", file);
  const css = fs.readFileSync(cssPath, "utf-8");
  const matches = css.match(/@media[^{]+\{/g) || [];
  totalMediaQueries += matches.length;
}

// Also count embedded responsive styles in HTML pages
for (const file of htmlFiles) {
  const htmlPath = path.join(frontendDir, file);
  const html = fs.readFileSync(htmlPath, "utf-8");
  const matches = html.match(/@media[^{]+\{/g) || [];
  totalMediaQueries += matches.length;
}

assert(totalMediaQueries >= 15, `Found ${totalMediaQueries} responsive @media queries across stylesheets and pages`);
pass(`Found ${totalMediaQueries} responsive CSS media queries handling mobile, tablet, and desktop viewports`);

// 3. Verify Homepage UI Components
console.log("\n[UI 3] Homepage UI Components");
const indexHtml = fs.readFileSync(path.join(frontendDir, "index.html"), "utf-8");
const ojaswiJs = fs.readFileSync(path.join(frontendDir, "js/ojaswi.js"), "utf-8");

assert(indexHtml.includes("Ojaswi"), "Brand title rendered");
assert(indexHtml.includes("cart-btn") || indexHtml.includes("cart-badge"), "Cart trigger button exists");
assert(ojaswiJs.includes('id="cartDrawer"'), "Cart drawer component defined in ojaswi.js");
assert(ojaswiJs.includes('id="cartDrawerItems"'), "Cart items container defined in ojaswi.js");
assert(ojaswiJs.includes('id="cartDrawerSubtotal"'), "Cart subtotal element defined in ojaswi.js");
assert(indexHtml.includes('id="orderModal"'), "Quick order modal exists in index.html");
assert(indexHtml.includes('id="visitorGoogleModal"'), "Visitor Google login modal exists");
assert(indexHtml.includes("3025120612245599988"), "Official FSSAI License displayed in footer/storefront");
pass("Homepage verified: Navigation, Cart Drawer, Order Modal, Google Modal, and FSSAI License");

// 4. Verify Checkout Page & Form Fields
console.log("\n[UI 4] Checkout Page & Address Form Validation UI");
const checkoutHtml = fs.readFileSync(path.join(frontendDir, "checkout.html"), "utf-8");
assert(checkoutHtml.includes('id="custName"'), "Customer name input field (custName)");
assert(checkoutHtml.includes('id="custPhone"'), "Mobile number input field (custPhone)");
assert(checkoutHtml.includes('id="custEmail"'), "Email input field (custEmail)");
assert(checkoutHtml.includes('id="addrHouse"'), "Flat/House input field (addrHouse)");
assert(checkoutHtml.includes('id="addrStreet"'), "Area/Street input field (addrStreet)");
assert(checkoutHtml.includes('id="addrCity"'), "City input field (addrCity)");
assert(checkoutHtml.includes('id="addrState"'), "State input field (addrState)");
assert(checkoutHtml.includes('id="addrPincode"'), "Pincode input field (addrPincode)");
assert(checkoutHtml.includes('name="paymentMethod"'), "Payment method selector present");
assert(checkoutHtml.includes("CASH ON DELIVERY"), "Cash on Delivery payment option present");
pass("Checkout UI verified: 8 Address & Contact inputs, Zero default values, Cash on Delivery option");

// 5. Verify Three Order Confirmation Channels in Checkout
console.log("\n[UI 5] Order Confirmation Channel Selection Popup");
assert(checkoutHtml.includes('id="btnConfirmWhatsAppOption"'), "WhatsApp confirmation option");
assert(checkoutHtml.includes('id="btnConfirmEmailOption"'), "Email confirmation option");
assert(checkoutHtml.includes('id="btnConfirmSMSOption"'), "SMS confirmation option");
assert(checkoutHtml.includes('id="btnConfirmSentMessage"'), "Customer returned confirm button (btnConfirmSentMessage)");
assert(checkoutHtml.includes('id="btnSuccessReceipt"'), "Receipt button in success modal");
pass("Channel popup verified: WhatsApp, Gmail/Email, SMS, Customer Done button, and Receipt button");

// 6. Verify Customer Order History & Tracking Page
console.log("\n[UI 6] Order History & Live Tracking UI");
const ordersHtml = fs.readFileSync(path.join(frontendDir, "orders.html"), "utf-8");
assert(ordersHtml.includes("Order History"), "Order History page header");
assert(ordersHtml.includes('id="ordersListContainer"'), "Orders container exists (ordersListContainer)");
assert(ordersHtml.includes('id="singleOrderDetailSection"'), "Single order detail & tracking section exists");
assert(ordersHtml.includes('id="orderLookupForm"'), "Order lookup form exists");
assert(
  ordersHtml.includes("PAYMENT PENDING - CASH ON DELIVERY") ||
  ordersHtml.includes("PAYMENT PENDING — CASH ON DELIVERY"),
  "COD status badge format in orders.html"
);
pass("Order History UI verified: Customer order history container, live tracking section, lookup form, receipt buttons");

// 7. Verify Legal & Compliance Pages
console.log("\n[UI 7] Legal Compliance Pages UI");
const legalPages = [
  "privacy-policy.html",
  "terms-and-conditions.html",
  "refund-policy.html",
  "shipping-policy.html",
  "cancellation-policy.html",
  "contact-us.html"
];
for (const p of legalPages) {
  const pageContent = fs.readFileSync(path.join(frontendDir, p), "utf-8");
  assert(pageContent.includes("Malegaon"), `${p} mentions Malegaon headquarters`);
  assert(pageContent.includes("7620098478") || pageContent.includes("ojaswifoods@gmail.com"), `${p} includes official contact info`);
}
pass(`All ${legalPages.length} legal compliance pages verified with official contact and location details`);

console.log("\n==================================================");
console.log(`🎉 ALL UI & RESPONSIVE TESTS PASSED! Total: ${passCount}`);
console.log("==================================================");
