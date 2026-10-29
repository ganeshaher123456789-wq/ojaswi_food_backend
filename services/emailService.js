import nodemailer from "nodemailer";
import { ENV } from "../config/env.js";
import { OJASWI_CONSTANTS } from "../config/constants.js";

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (ENV.SMTP_USER && ENV.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: ENV.SMTP_HOST,
      port: ENV.SMTP_PORT,
      secure: ENV.SMTP_SECURE,
      auth: {
        user: ENV.SMTP_USER,
        pass: ENV.SMTP_PASS
      }
    });
  }
  return transporter;
}

export const emailService = {
  /**
   * Sends 6-digit OTP verification code to customer email
   */
  async sendOtpEmail(email, otp) {
    const subject = `Your Ojaswi Premium Verification Code: ${otp}`;
    const html = `
      <div style="background-color: #080808; color: #ffffff; font-family: 'Segoe UI', Arial, sans-serif; padding: 40px 20px; text-align: center;">
        <div style="max-width: 500px; margin: auto; background-color: #121212; border: 1px solid rgba(217,164,65,0.3); border-radius: 8px; padding: 35px 25px;">
          <h1 style="color: #f0c86b; font-family: Georgia, serif; font-size: 32px; margin: 0 0 8px 0; letter-spacing: 2px;">OJASWI</h1>
          <p style="color: #999999; font-size: 11px; letter-spacing: 4px; margin: 0 0 25px 0;">AUTHENTIC INDIAN SPICES</p>
          <div style="border-top: 1px solid rgba(217,164,65,0.2); border-bottom: 1px solid rgba(217,164,65,0.2); padding: 25px 0; margin-bottom: 25px;">
            <p style="color: #dddddd; font-size: 14px; margin-bottom: 15px;">Your one-time verification code is:</p>
            <div style="background: #1c1c1c; border: 1px dashed #d9a441; border-radius: 6px; display: inline-block; padding: 12px 30px; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #f0c86b;">
              ${otp}
            </div>
            <p style="color: #888888; font-size: 12px; margin-top: 15px;">Valid for ${ENV.OTP_EXPIRY_MINUTES} minutes. Do not share this code.</p>
          </div>
          <p style="color: #777777; font-size: 11px; line-height: 1.6; margin: 0;">
            ${OJASWI_CONSTANTS.PACKED_BY}<br/>
            FSSAI Lic. ${OJASWI_CONSTANTS.FSSAI_LICENSE} | Malegaon, Maharashtra
          </p>
        </div>
      </div>
    `;

    const transport = getTransporter();
    if (transport) {
      try {
        await transport.sendMail({
          from: ENV.EMAIL_FROM,
          to: email,
          subject,
          html
        });
        console.log(`[Email] OTP email successfully sent to ${email}`);
        return { success: true };
      } catch (err) {
        console.error("[Email] SMTP dispatch failed:", err.message);
        throw new Error("Unable to send OTP email. Please verify SMTP settings.");
      }
    }

    // Development Console Simulation
    console.log("==================================================");
    console.log(`📧 [EMAIL:DEV-SIMULATION] Recipient: ${email}`);
    console.log(`🔑 Verification Code: ${otp}`);
    console.log(`⏱️  Expires in: ${ENV.OTP_EXPIRY_MINUTES} minutes`);
    console.log("==================================================");
    return { success: true, simulated: true };
  },

  /**
   * Sends Order Confirmation Email with detailed invoice
   */
  async sendOrderEmails(order, items) {
    const itemsHtml = items
      .map(
        (i) => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.08);">${i.product_name} (${i.sku || "OJASWI"})</td>
          <td style="padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.08); text-align: center;">${i.quantity}</td>
          <td style="padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.08); text-align: right;">₹${i.unit_price}</td>
          <td style="padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.08); text-align: right;">₹${i.total_price}</td>
        </tr>
      `
      )
      .join("");

    const addr = typeof order.delivery_address === "object"
      ? order.delivery_address
      : JSON.parse(order.delivery_address_json || "{}");

    const isCOD = !order.payment_method || 
                  order.payment_method.toLowerCase().includes("cash") || 
                  order.payment_method.toLowerCase().includes("cod");
    const paymentStatusDisplay = isCOD ? "Payment Pending — Cash on Delivery" : (order.payment_status || "Pending");

    const orderHtml = `
      <div style="background-color: #080808; color: #ffffff; font-family: 'Segoe UI', Arial, sans-serif; padding: 40px 20px;">
        <div style="max-width: 650px; margin: auto; background-color: #121212; border: 1px solid rgba(217,164,65,0.3); border-radius: 8px; padding: 35px 25px;">
          <div style="text-align: center; margin-bottom: 25px;">
            <h1 style="color: #f0c86b; font-family: Georgia, serif; font-size: 30px; margin: 0 0 5px 0;">OJASWI PREMIUM</h1>
            <p style="color: #999999; font-size: 11px; letter-spacing: 3px; margin: 0;">OFFICIAL ORDER INVOICE - ${order.id}</p>
          </div>
          <div style="background: #171717; border-left: 3px solid #d9a441; padding: 15px; margin-bottom: 25px; border-radius: 4px;">
            <p style="margin: 0 0 5px 0; color: #f0c86b; font-weight: bold;">Order Status: ${order.order_status || 'Confirmed'}</p>
            <p style="margin: 0; color: #cccccc; font-size: 13px;">Payment: ${order.payment_method || 'Cash on Delivery'} (${paymentStatusDisplay})</p>
          </div>
          <div style="margin-bottom: 25px;">
            <h3 style="color: #d9a441; font-size: 14px; text-transform: uppercase; margin-bottom: 8px;">Delivery Details</h3>
            <p style="color: #dddddd; font-size: 13px; margin: 0; line-height: 1.5;">
              <strong>${order.customer_name}</strong> | Phone: ${order.customer_phone}<br/>
              ${addr.flat_house || ""}, ${addr.area_street || ""}<br/>
              ${addr.city || ""}, ${addr.state || ""} - ${addr.pincode || ""}
            </p>
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #dddddd; margin-bottom: 20px;">
            <thead>
              <tr style="background: #1c1c1c; color: #f0c86b;">
                <th style="padding: 10px; text-align: left;">Product</th>
                <th style="padding: 10px; text-align: center;">Qty</th>
                <th style="padding: 10px; text-align: right;">Price</th>
                <th style="padding: 10px; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3" style="padding: 12px 10px; text-align: right; font-weight: bold; color: #f0c86b; font-size: 15px;">Final Amount:</td>
                <td style="padding: 12px 10px; text-align: right; font-weight: bold; color: #f0c86b; font-size: 15px;">₹${order.total_amount}</td>
              </tr>
            </tfoot>
          </table>
          <p style="color: #777777; font-size: 11px; text-align: center; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 20px;">
            ${OJASWI_CONSTANTS.PACKED_BY}<br/>
            FSSAI Lic. ${OJASWI_CONSTANTS.FSSAI_LICENSE} | Contact: ${OJASWI_CONSTANTS.DISPLAY_PHONE}
          </p>
        </div>
      </div>
    `;

    const transport = getTransporter();
    const result = {
      customer: { attempted: false, success: false, error: null, provider: transport ? "smtp" : (ENV.EMAIL_PROVIDER || "console") },
      company: { attempted: false, success: false, error: null, provider: transport ? "smtp" : (ENV.EMAIL_PROVIDER || "console") }
    };

    // 1. Send to Customer if customer email exists
    if (order.customer_email) {
      result.customer.attempted = true;
      if (transport) {
        try {
          await transport.sendMail({
            from: ENV.EMAIL_FROM,
            to: order.customer_email,
            subject: `Order Confirmed: ${order.id} - Ojaswi Premium Spices`,
            html: orderHtml
          });
          result.customer.success = true;
          console.log(`[Email] Customer order receipt sent to ${order.customer_email}`);
        } catch (err) {
          result.customer.success = false;
          result.customer.error = err.message;
          console.warn("[Email] Failed to send customer receipt:", err.message);
        }
      } else if (ENV.EMAIL_PROVIDER === "smtp") {
        result.customer.success = false;
        result.customer.error = "SMTP credentials (SMTP_USER, SMTP_PASS) not configured.";
        console.warn("[Email] SMTP configured but credentials missing.");
      } else {
        result.customer.success = true;
        result.customer.provider = "console_simulation";
        console.log(`[Email:Dev] Simulated customer receipt to ${order.customer_email} for order ${order.id}`);
      }
    }

    // 2. Send to Ojaswi Company Email
    if (ENV.COMPANY_NOTIFY_EMAIL) {
      result.company.attempted = true;
      if (transport) {
        try {
          await transport.sendMail({
            from: ENV.EMAIL_FROM,
            to: ENV.COMPANY_NOTIFY_EMAIL,
            subject: `NEW ORDER ALERT: ${order.id} (₹${order.total_amount})`,
            html: orderHtml
          });
          result.company.success = true;
          console.log(`[Email] Company order alert sent to ${ENV.COMPANY_NOTIFY_EMAIL}`);
        } catch (err) {
          result.company.success = false;
          result.company.error = err.message;
          console.warn("[Email] Failed to send company alert:", err.message);
        }
      } else if (ENV.EMAIL_PROVIDER === "smtp") {
        result.company.success = false;
        result.company.error = "SMTP credentials (SMTP_USER, SMTP_PASS) not configured.";
      } else {
        result.company.success = true;
        result.company.provider = "console_simulation";
        console.log(`[Email:Dev] Simulated company alert to ${ENV.COMPANY_NOTIFY_EMAIL} for order ${order.id}`);
      }
    }

    return result;
  }
};
