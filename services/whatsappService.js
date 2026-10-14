import { ENV } from "../config/env.js";

export const whatsappService = {
  /**
   * Dispatches official WhatsApp Business Notification to Ojaswi Owner
   */
  async notifyOwnerNewOrder(order, items) {
    const addr = typeof order.delivery_address === "object"
      ? order.delivery_address
      : JSON.parse(order.delivery_address_json || "{}");

    const itemsSummary = items
      .map((i) => `• ${i.product_name} x ${i.quantity} (₹${i.total_price})`)
      .join("\n");

    const messageText = 
`🌶️ *NEW OJASWI ORDER*
*Order ID:* ${order.id}
*Customer:* ${order.customer_name}
*Phone:* +91 ${order.customer_phone}
*Email:* ${order.customer_email || "N/A"}

*Products:*
${itemsSummary}

*Total Amount:* ₹${order.total_amount}
*Payment Method:* ${order.payment_method}
*Payment Status:* ${order.payment_status}

*Delivery Address:*
${addr.flat_house || ""}, ${addr.area_street || ""}, ${addr.city || ""}, ${addr.state || ""} - ${addr.pincode || ""}

_Ojaswi Foods - Malegaon 423203_`;

    // 1. Meta WhatsApp Cloud API (Official Cloud API)
    if (
      ENV.WHATSAPP_PROVIDER === "meta_cloud" &&
      ENV.WHATSAPP_PHONE_NUMBER_ID &&
      ENV.WHATSAPP_ACCESS_TOKEN
    ) {
      try {
        const recipient = ENV.WHATSAPP_OWNER_NUMBER.replace(/\D/g, "");
        const response = await fetch(
          `https://graph.facebook.com/v18.0/${ENV.WHATSAPP_PHONE_NUMBER_ID}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${ENV.WHATSAPP_ACCESS_TOKEN}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: recipient,
              type: "text",
              text: { body: messageText }
            })
          }
        );
        const data = await response.json();
        console.log(`[WhatsApp:Meta] Dispatched order notification to owner:`, data);
        return { success: true, provider: "meta_cloud", data };
      } catch (err) {
        console.error("[WhatsApp:Meta] Failed to send WhatsApp notification:", err.message);
        throw err;
      }
    }

    // 2. Twilio WhatsApp API
    if (
      ENV.WHATSAPP_PROVIDER === "twilio" &&
      ENV.TWILIO_ACCOUNT_SID &&
      ENV.TWILIO_AUTH_TOKEN
    ) {
      try {
        const auth = Buffer.from(`${ENV.TWILIO_ACCOUNT_SID}:${ENV.TWILIO_AUTH_TOKEN}`).toString("base64");
        const recipient = ENV.WHATSAPP_OWNER_NUMBER.startsWith("+")
          ? ENV.WHATSAPP_OWNER_NUMBER
          : `+${ENV.WHATSAPP_OWNER_NUMBER}`;

        const body = new URLSearchParams({
          To: `whatsapp:${recipient}`,
          From: `whatsapp:${ENV.TWILIO_PHONE_NUMBER}`,
          Body: messageText
        });

        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${ENV.TWILIO_ACCOUNT_SID}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${auth}`,
              "Content-Type": "application/x-www-form-urlencoded"
            },
            body: body.toString()
          }
        );
        const data = await response.json();
        console.log(`[WhatsApp:Twilio] Dispatched notification:`, data.sid);
        return { success: true, provider: "twilio", data };
      } catch (err) {
        console.error("[WhatsApp:Twilio] Failed:", err.message);
        throw err;
      }
    }

    // 3. Development Console Simulation
    console.log("==================================================");
    console.log("📲 [WHATSAPP:OFFICIAL-NOTIFICATION-SIMULATION]");
    console.log(`To Ojaswi Owner: +${ENV.WHATSAPP_OWNER_NUMBER}`);
    console.log(messageText);
    console.log("==================================================");
    return { success: true, provider: "console_simulation" };
  }
};
