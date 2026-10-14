import { db } from "../config/db.js";
import { whatsappService } from "./whatsappService.js";
import { smsService } from "./smsService.js";
import { emailService } from "./emailService.js";
import { OJASWI_CONSTANTS } from "../config/constants.js";
import { ENV } from "../config/env.js";

export const notificationService = {
  /**
   * Dispatches WhatsApp, SMS, and Email alerts for a confirmed order.
   * Completely resilient: an external API failure will never throw or cancel the order.
   */
  async notifyOrderPlaced(order, items) {
    console.log(`[Notifications] Initiating multi-channel dispatch for order ${order.id}...`);

    const tasks = [
      // 1. WhatsApp to Ojaswi Owner
      (async () => {
        try {
          await whatsappService.notifyOwnerNewOrder(order, items);
          await db.run(
            `INSERT INTO notifications (order_id, channel, recipient, payload, status, sent_at)
             VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
            [order.id, "whatsapp", ENV.WHATSAPP_OWNER_NUMBER, JSON.stringify({ event: "NEW_ORDER" }), "sent"]
          );
        } catch (err) {
          console.warn(`[Notifications] WhatsApp failed for ${order.id}:`, err.message);
          await db.run(
            `INSERT INTO notifications (order_id, channel, recipient, payload, status, error_message)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [order.id, "whatsapp", ENV.WHATSAPP_OWNER_NUMBER, JSON.stringify({ event: "NEW_ORDER" }), "failed", err.message]
          );
        }
      })(),

      // 2. SMS to Ojaswi Owner
      (async () => {
        try {
          await smsService.sendOrderSms(
            OJASWI_CONSTANTS.PHONE,
            order.id,
            order.customer_name,
            order.total_amount,
            order.payment_method
          );
          await db.run(
            `INSERT INTO notifications (order_id, channel, recipient, payload, status, sent_at)
             VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
            [order.id, "sms", OJASWI_CONSTANTS.PHONE, JSON.stringify({ event: "NEW_ORDER_SMS" }), "sent"]
          );
        } catch (err) {
          console.warn(`[Notifications] SMS failed for ${order.id}:`, err.message);
          await db.run(
            `INSERT INTO notifications (order_id, channel, recipient, payload, status, error_message)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [order.id, "sms", OJASWI_CONSTANTS.PHONE, JSON.stringify({ event: "NEW_ORDER_SMS" }), "failed", err.message]
          );
        }
      })(),

      // 3. Email to Ojaswi Owner & Customer
      (async () => {
        try {
          await emailService.sendOrderEmails(order, items);
          await db.run(
            `INSERT INTO notifications (order_id, channel, recipient, payload, status, sent_at)
             VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
            [order.id, "email", order.customer_email || OJASWI_CONSTANTS.EMAIL, JSON.stringify({ event: "ORDER_INVOICE" }), "sent"]
          );
        } catch (err) {
          console.warn(`[Notifications] Email failed for ${order.id}:`, err.message);
          await db.run(
            `INSERT INTO notifications (order_id, channel, recipient, payload, status, error_message)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [order.id, "email", order.customer_email || OJASWI_CONSTANTS.EMAIL, JSON.stringify({ event: "ORDER_INVOICE" }), "failed", err.message]
          );
        }
      })()
    ];

    // Wait for all notifications without failing
    await Promise.allSettled(tasks);
    console.log(`[Notifications] Multi-channel notification pipeline completed for ${order.id}.`);
  }
};
