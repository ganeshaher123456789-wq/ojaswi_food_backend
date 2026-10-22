import { OJASWI_CONSTANTS } from "../config/constants.js";

/**
 * Converts numeric amount to Indian currency words
 */
function numberToWordsINR(amount) {
  const num = Math.round(amount);
  if (num === 0) return "Zero Rupees Only";

  const a = [
    "", "One ", "Two ", "Three ", "Four ", "Five ", "Six ", "Seven ", "Eight ", "Nine ",
    "Ten ", "Eleven ", "Twelve ", "Thirteen ", "Fourteen ", "Fifteen ", "Sixteen ", "Seventeen ", "Eighteen ", "Nineteen "
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function inWords(n) {
    if (n < 20) return a[n];
    const digit = n % 10;
    return b[Math.floor(n / 10)] + (digit ? " " + a[digit] : " ");
  }

  let words = "";
  let remainder = num;

  if (Math.floor(remainder / 10000000) > 0) {
    words += inWords(Math.floor(remainder / 10000000)) + "Crore ";
    remainder %= 10000000;
  }
  if (Math.floor(remainder / 100000) > 0) {
    words += inWords(Math.floor(remainder / 100000)) + "Lakh ";
    remainder %= 100000;
  }
  if (Math.floor(remainder / 1000) > 0) {
    words += inWords(Math.floor(remainder / 1000)) + "Thousand ";
    remainder %= 1000;
  }
  if (Math.floor(remainder / 100) > 0) {
    words += inWords(Math.floor(remainder / 100)) + "Hundred ";
    remainder %= 100;
  }
  if (remainder > 0) {
    words += inWords(remainder);
  }

  return words.trim() + " Rupees Only";
}

/**
 * Formats full structured receipt object using actual order data
 */
export function generateReceiptData(order) {
  const created = new Date(order.created_at || Date.now());
  const dateStr = created.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
  const timeStr = created.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit"
  });

  const rawId = (order.id || "").replace(/^#/, "");
  const invoiceNumber = `OJ-INV-${created.getFullYear()}-${rawId}`;

  // Parse delivery address if needed
  let addr = order.delivery_address;
  if (!addr && order.delivery_address_json) {
    try {
      addr = JSON.parse(order.delivery_address_json);
    } catch {
      addr = { address: order.delivery_address_json };
    }
  }
  addr = addr || {};

  const addressLine = [
    addr.flat_house,
    addr.area_street,
    addr.city || "Malegaon",
    addr.district ? `${addr.district} Dist.` : "",
    addr.state || "Maharashtra",
    addr.pincode ? `PIN: ${addr.pincode}` : "423203"
  ]
    .filter(Boolean)
    .join(", ");

  const items = (order.items || []).map((it) => {
    const unitPrice = Number(it.unit_price) || 0;
    const qty = Number(it.quantity) || 1;
    const itemTotal = Number(it.total_price) || unitPrice * qty;
    // 5% GST on spices in India (2.5% CGST + 2.5% SGST)
    const taxableValue = Math.round((itemTotal / 1.05) * 100) / 100;
    const gstTotal = Math.round((itemTotal - taxableValue) * 100) / 100;

    return {
      product_id: it.product_id,
      name: it.product_name,
      sku: it.sku || `OJ-${it.product_id || "SPICE"}`,
      weight: it.weight || "NET WEIGHT 500g",
      unitPrice,
      quantity: qty,
      taxableValue,
      gstRate: "5% (CGST 2.5% + SGST 2.5%)",
      gstAmount: gstTotal,
      totalPrice: itemTotal
    };
  });

  const subtotal = Number(order.subtotal) || items.reduce((sum, it) => sum + it.totalPrice, 0);
  const deliveryCharge = Number(order.delivery_charge) || 0;
  const discountAmount = Number(order.discount_amount) || 0;
  const totalAmount = Number(order.total_amount) || subtotal + deliveryCharge - discountAmount;

  const totalGst = Math.round(totalAmount * 0.05 * 100) / 100;

  return {
    invoiceNumber,
    invoice_number: invoiceNumber,
    orderId: order.id.startsWith("#") ? order.id : `#${order.id}`,
    order_id: order.id.startsWith("#") ? order.id : `#${order.id}`,
    fssai_license: OJASWI_CONSTANTS.FSSAI_LICENSE,
    amount_in_words: numberToWordsINR(totalAmount),
    tax_breakdown: {
      cgst_2_5_percent: Math.round((totalGst / 2) * 100) / 100,
      sgst_2_5_percent: Math.round((totalGst / 2) * 100) / 100,
      total_gst_5_percent: totalGst
    },
    invoiceDate: `${dateStr} at ${timeStr}`,
    orderStatus: order.order_status || "Confirmed",
    paymentStatus: order.payment_status === "Paid" ? "PAID" : "PENDING",
    paymentMethod: ((order.payment_method || "").toLowerCase().includes("cash on delivery") || (order.payment_method || "").toLowerCase().includes("cod")) ? "CASH ON DELIVERY" : (order.payment_method || "CASH ON DELIVERY"),
    isPaid: order.payment_status === "Paid",
    seller: {
      name: "Ojaswi Foods",
      tradeName: "Ojaswi Premium Authentic Indian Spices",
      fssaiLicense: OJASWI_CONSTANTS.FSSAI_LICENSE,
      address: OJASWI_CONSTANTS.PACKED_BY,
      phone: "+91 7620098478",
      email: "ojaswifoods@gmail.com",
      origin: "Malegaon, Nashik, Maharashtra - 423203"
    },
    customer: {
      name: order.customer_name,
      phone: `+91 ${order.customer_phone}`,
      email: order.customer_email || "Not specified",
      address: addressLine,
      structuredAddress: addr
    },
    items,
    pricing: {
      subtotal,
      deliveryCharge,
      discountAmount,
      totalAmount,
      amountInWords: numberToWordsINR(totalAmount),
      currency: "INR (₹)"
    },
    tracking: {
      courier: "India Post Speed Post / DTDC Express",
      awb: "OJ-" + rawId.toUpperCase(),
      dispatchUnit: "Ojaswi Spices Unit, Malegaon - 423203"
    }
  };
}

/**
 * Generates an official, printer-friendly HTML Tax Invoice
 */
export function renderReceiptHtml(receipt) {
  const itemsRows = receipt.items
    .map(
      (it, idx) => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 12px 10px; font-weight: 600; color: #111;">${idx + 1}. ${it.name}</td>
      <td style="padding: 12px 10px; color: #555; font-size: 12px;">${it.sku}</td>
      <td style="padding: 12px 10px; color: #555; text-align: center;">${it.weight}</td>
      <td style="padding: 12px 10px; text-align: center; font-weight: 600;">${it.quantity}</td>
      <td style="padding: 12px 10px; text-align: right;">₹${it.unitPrice.toFixed(2)}</td>
      <td style="padding: 12px 10px; text-align: right; font-weight: 700; color: #111;">₹${it.totalPrice.toFixed(2)}</td>
    </tr>
  `
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Tax Invoice ${receipt.invoiceNumber} | Ojaswi Foods</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      margin: 0;
      padding: 30px 20px;
      background: #f3f4f6;
      color: #1f2937;
      line-height: 1.5;
    }
    .invoice-box {
      max-width: 820px;
      margin: 0 auto;
      background: #ffffff;
      padding: 40px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #d9a441;
      padding-bottom: 20px;
      margin-bottom: 25px;
    }
    .brand-title {
      font-family: 'Cormorant Garamond', serif;
      font-size: 32px;
      font-weight: 700;
      color: #111827;
      margin: 0;
      letter-spacing: 1px;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .badge-paid { background: #dcfce7; color: #15803d; }
    .badge-pending { background: #fef3c7; color: #b45309; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th {
      background: #f9fafb;
      color: #374151;
      text-align: left;
      padding: 12px 10px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid #e5e7eb;
    }
    .btn {
      background: #d9a441;
      color: #000;
      font-weight: 700;
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .invoice-box { box-shadow: none; border: none; padding: 15px; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="max-width: 820px; margin: 0 auto 15px auto; display: flex; justify-content: space-between; align-items: center;">
    <a href="/orders" style="color: #6b7280; text-decoration: none; font-size: 13px;">&larr; Back to Orders</a>
    <button onclick="window.print()" class="btn">🖨️ Print / Download PDF</button>
  </div>

  <div class="invoice-box">
    <!-- Header -->
    <div class="header">
      <div>
        <h1 class="brand-title">OJASWI FOODS</h1>
        <div style="font-size: 11px; color: #d9a441; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;">
          Premium Authentic Indian Spices
        </div>
        <div style="font-size: 12px; color: #4b5563; margin-top: 6px;">
          ${receipt.seller.address}<br>
          FSSAI Lic. No: <strong>${receipt.seller.fssaiLicense}</strong><br>
          Customer Care: ${receipt.seller.phone} | ${receipt.seller.email}
        </div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 13px; font-weight: 700; color: #6b7280;">TAX INVOICE / CASH RECEIPT</div>
        <div style="font-size: 18px; font-weight: 700; color: #111827; margin: 3px 0;">${receipt.invoiceNumber}</div>
        <div style="font-size: 12px; color: #6b7280;">Date: ${receipt.invoiceDate}</div>
        <div style="margin-top: 8px;">
          <span class="badge ${receipt.isPaid ? 'badge-paid' : 'badge-pending'}">
            Payment Method: ${receipt.paymentMethod} • Payment Status: ${receipt.paymentStatus}
          </span>
          <div style="font-size: 13px; font-weight: 700; color: ${receipt.isPaid ? '#15803d' : '#b45309'}; margin-top: 6px;">
            Amount Payable: ₹${receipt.pricing.totalAmount.toFixed(2)} ${receipt.isPaid ? '(PAID)' : '(COLLECT ON DELIVERY)'}
          </div>
        </div>
      </div>
    </div>

    <!-- Bill to & Ship to -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; background: #f9fafb; padding: 18px 20px; border-radius: 6px; margin-bottom: 25px; font-size: 13px;">
      <div>
        <div style="font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Billed & Shipped To:</div>
        <div style="font-size: 15px; font-weight: 700; color: #111; margin-top: 4px;">${receipt.customer.name}</div>
        <div style="color: #374151; margin-top: 2px;">Phone: ${receipt.customer.phone}</div>
        <div style="color: #6b7280;">Email: ${receipt.customer.email}</div>
        <div style="color: #374151; margin-top: 4px; line-height: 1.4;">${receipt.customer.address}</div>
      </div>
      <div>
        <div style="font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Dispatch & Order Details:</div>
        <div style="color: #374151; margin-top: 4px;">Order ID: <strong>${receipt.orderId}</strong></div>
        <div style="color: #374151;">Order Status: <strong>${receipt.orderStatus}</strong></div>
        <div style="color: #374151;">Courier Partner: <strong>${receipt.tracking.courier}</strong></div>
        <div style="color: #374151;">Dispatch Unit: ${receipt.tracking.dispatchUnit}</div>
      </div>
    </div>

    <!-- Line Items Table -->
    <table>
      <thead>
        <tr>
          <th>Description of Spices</th>
          <th>SKU</th>
          <th style="text-align: center;">Pack Size</th>
          <th style="text-align: center;">Qty</th>
          <th style="text-align: right;">Rate</th>
          <th style="text-align: right;">Amount (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="4" style="border: none;"></td>
          <td style="padding: 8px 10px; text-align: right; color: #6b7280; font-size: 13px;">Subtotal:</td>
          <td style="padding: 8px 10px; text-align: right; font-weight: 600;">₹${receipt.pricing.subtotal.toFixed(2)}</td>
        </tr>
        <tr>
          <td colspan="4" style="border: none;"></td>
          <td style="padding: 6px 10px; text-align: right; color: #15803d; font-size: 13px;">Delivery Fee:</td>
          <td style="padding: 6px 10px; text-align: right; color: #15803d; font-weight: 600;">FREE</td>
        </tr>
        <tr style="border-top: 2px solid #111827;">
          <td colspan="4" style="border: none; padding-top: 10px;">
            <div style="font-size: 12px; color: #6b7280;">Amount in words:</div>
            <div style="font-size: 13px; font-weight: 600; color: #111827;">${receipt.pricing.amountInWords}</div>
          </td>
          <td style="padding: 10px; text-align: right; font-weight: 700; font-size: 16px; color: #111;">Total:</td>
          <td style="padding: 10px; text-align: right; font-weight: 700; font-size: 18px; color: #b8860b;">₹${receipt.pricing.totalAmount.toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>

    <!-- Footer Note & Declaration -->
    <div style="margin-top: 35px; padding-top: 20px; border-top: 1px dashed #d1d5db; display: flex; justify-content: space-between; align-items: flex-end; font-size: 11.5px; color: #6b7280;">
      <div>
        <p style="margin: 0; font-weight: 600; color: #374151;">Declaration:</p>
        <p style="margin: 3px 0 0 0; max-width: 450px;">
          We declare that this invoice shows the actual price of the authentic Indian spices described and that all particulars are true and correct. Spices packed hygienically under FSSAI license 3025120612245599988.
        </p>
      </div>
      <div style="text-align: right;">
        <div style="font-weight: 700; color: #111827;">For OJASWI FOODS</div>
        <div style="height: 35px;"></div>
        <div style="font-size: 11px; border-top: 1px solid #9ca3af; padding-top: 3px;">Authorized Signatory</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export default { generateReceiptData, renderReceiptHtml };
