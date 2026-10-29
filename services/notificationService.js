import mongoose from "mongoose";
import { db } from "../config/db.js";
import { whatsappService } from "./whatsappService.js";
import { smsService } from "./smsService.js";
import { emailService } from "./emailService.js";
import { OJASWI_CONSTANTS } from "../config/constants.js";
import { ENV } from "../config/env.js";
import { Notification } from "../models/index.js";

/**
 * Persists a notification record to both SQLite and MongoDB Atlas (if available)
 */
async function recordNotification({ order_id, channel, recipient, payload, status, error_message }) {
  const payloadStr = typeof payload === "string" ? payload : JSON.stringify(payload || {});
  const now = new Date();

  // 1. SQLite persistence
  try {
    if (status === "sent" || status === "simulated_console") {
      await db.run(
        `INSERT INTO notifications (order_id, channel, recipient, payload, status, sent_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
        [order_id, channel, recipient || "unknown", payloadStr, status]
      );
    } else {
      await db.run(
        `INSERT INTO notifications (order_id, channel, recipient, payload, status, error_message)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [order_id, channel, recipient || "unknown", payloadStr, status, error_message || null]
      );
    }
  } catch (sqlErr) {
    console.warn(`[Notifications] SQLite record error for ${order_id}:`, sqlErr.message);
  }

  // 2. MongoDB Atlas persistence
  try {
    if (mongoose.connection && mongoose.connection.readyState === 1 && Notification) {
      await Notification.create({
        order_id,
        channel,
        recipient: recipient || "unknown",
        payload: payloadStr,
        status,
        error_message: error_message || null,
        sent_at: (status === "sent" || status === "simulated_console") ? now : null
      });
    }
  } catch (mErr) {
    console.warn(`[Notifications] MongoDB Atlas record notice for ${order_id}:`, mErr.message);
  }
}

export const notificationService = {
  /**
   * Dispatches WhatsApp, SMS, and Email alerts for a confirmed order.
   * Completely resilient: an external API failure will never throw or cancel the order.
   * Returns exact delivery statuses across all channels.
   */
  async notifyOrderPlaced(order, items) {
    console.log(`[Notifications] Initiating multi-channel dispatch for order ${order.id}...`);

    const statuses = {
      whatsapp_owner: { status: "pending", error: null },
      sms_customer: { status: "pending", error: null },
      sms_owner: { status: "pending", error: null },
      email_customer: { status: "pending", error: null },
      email_company: { status: "pending", error: null }
    };

    const tasks = [
      // 1. WhatsApp to Ojaswi Owner
      (async () => {
        try {
          const res = await whatsappService.notifyOwnerNewOrder(order, items);
          const st = res?.provider === "console" ? "simulated_console" : "sent";
          statuses.whatsapp_owner = { status: st, error: null };
          await recordNotification({
            order_id: order.id,
            channel: "whatsapp",
            recipient: ENV.WHATSAPP_OWNER_NUMBER,
            payload: { event: "NEW_ORDER", provider: res?.provider || ENV.WHATSAPP_PROVIDER },
            status: st
          });
        } catch (err) {
          console.warn(`[Notifications] WhatsApp failed for ${order.id}:`, err.message);
          statuses.whatsapp_owner = { status: "failed", error: err.message };
          await recordNotification({
            order_id: order.id,
            channel: "whatsapp",
            recipient: ENV.WHATSAPP_OWNER_NUMBER,
            payload: { event: "NEW_ORDER", provider: ENV.WHATSAPP_PROVIDER },
            status: "failed",
            error_message: err.message
          });
        }
      })(),

      // 2. SMS to Customer (if phone is provided)
      (async () => {
        if (!order.customer_phone) {
          statuses.sms_customer = { status: "skipped", error: "No customer phone provided" };
          return;
        }
        try {
          const res = await smsService.sendCustomerOrderSms(
            order.customer_phone,
            order.id,
            order.customer_name,
            order.total_amount,
            order.payment_method
          );
          const st = res?.provider === "console_simulation" ? "simulated_console" : "sent";
          statuses.sms_customer = { status: st, error: null };
          await recordNotification({
            order_id: order.id,
            channel: "sms_customer",
            recipient: order.customer_phone,
            payload: { event: "ORDER_CONFIRMATION_CUSTOMER_SMS", provider: res?.provider || ENV.SMS_PROVIDER },
            status: st
          });
        } catch (err) {
          console.warn(`[Notifications] Customer SMS failed for ${order.id}:`, err.message);
          statuses.sms_customer = { status: "failed", error: err.message };
          await recordNotification({
            order_id: order.id,
            channel: "sms_customer",
            recipient: order.customer_phone,
            payload: { event: "ORDER_CONFIRMATION_CUSTOMER_SMS", provider: ENV.SMS_PROVIDER },
            status: "failed",
            error_message: err.message
          });
        }
      })(),

      // 3. SMS to Ojaswi Owner
      (async () => {
        try {
          const res = await smsService.sendOrderSms(
            OJASWI_CONSTANTS.PHONE,
            order.id,
            order.customer_name,
            order.total_amount,
            order.payment_method
          );
          const st = res?.provider === "console_simulation" ? "simulated_console" : "sent";
          statuses.sms_owner = { status: st, error: null };
          await recordNotification({
            order_id: order.id,
            channel: "sms_owner",
            recipient: OJASWI_CONSTANTS.PHONE,
            payload: { event: "NEW_ORDER_OWNER_SMS", provider: res?.provider || ENV.SMS_PROVIDER },
            status: st
          });
        } catch (err) {
          console.warn(`[Notifications] Owner SMS failed for ${order.id}:`, err.message);
          statuses.sms_owner = { status: "failed", error: err.message };
          await recordNotification({
            order_id: order.id,
            channel: "sms_owner",
            recipient: OJASWI_CONSTANTS.PHONE,
            payload: { event: "NEW_ORDER_OWNER_SMS", provider: ENV.SMS_PROVIDER },
            status: "failed",
            error_message: err.message
          });
        }
      })(),

      // 4. Email to Customer & Company
      (async () => {
        try {
          const emailRes = await emailService.sendOrderEmails(order, items);

          // Record customer email status
          if (order.customer_email) {
            const custSent = emailRes.customer.success;
            const custStatus = custSent ? (emailRes.customer.provider === "console_simulation" ? "simulated_console" : "sent") : "failed";
            statuses.email_customer = { status: custStatus, error: emailRes.customer.error };
            await recordNotification({
              order_id: order.id,
              channel: "email_customer",
              recipient: order.customer_email,
              payload: { event: "ORDER_CONFIRMATION_EMAIL", provider: emailRes.customer.provider },
              status: custStatus,
              error_message: emailRes.customer.error
            });
          } else {
            statuses.email_customer = { status: "skipped", error: "No customer email provided" };
          }

          // Record company alert status
          if (ENV.COMPANY_NOTIFY_EMAIL) {
            const compSent = emailRes.company.success;
            const compStatus = compSent ? (emailRes.company.provider === "console_simulation" ? "simulated_console" : "sent") : "failed";
            statuses.email_company = { status: compStatus, error: emailRes.company.error };
            await recordNotification({
              order_id: order.id,
              channel: "email_company",
              recipient: ENV.COMPANY_NOTIFY_EMAIL,
              payload: { event: "NEW_ORDER_ALERT_EMAIL", provider: emailRes.company.provider },
              status: compStatus,
              error_message: emailRes.company.error
            });
          }
        } catch (err) {
          console.warn(`[Notifications] Email dispatch error for ${order.id}:`, err.message);
          statuses.email_customer = { status: "failed", error: err.message };
          statuses.email_company = { status: "failed", error: err.message };
          await recordNotification({
            order_id: order.id,
            channel: "email",
            recipient: order.customer_email || OJASWI_CONSTANTS.EMAIL,
            payload: { event: "ORDER_INVOICE", provider: ENV.EMAIL_PROVIDER },
            status: "failed",
            error_message: err.message
          });
        }
      })()
    ];

    // Wait for all notification tasks without failing
    await Promise.allSettled(tasks);
    console.log(`[Notifications] Multi-channel notification pipeline completed for ${order.id}.`);
    return statuses;
  }
};
