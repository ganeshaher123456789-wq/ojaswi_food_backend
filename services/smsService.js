import { ENV } from "../config/env.js";

export const smsService = {
  /**
   * Sends an OTP via SMS to an Indian mobile number
   */
  async sendOtpSms(phone, otp) {
    const message = `Your Ojaswi Premium verification code is: ${otp}. Valid for ${ENV.OTP_EXPIRY_MINUTES} minutes. Do not share this with anyone. - Ojaswi Foods Malegaon`;

    if (ENV.SMS_PROVIDER === "fast2sms" && ENV.FAST2SMS_API_KEY) {
      try {
        const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
          method: "POST",
          headers: {
            authorization: ENV.FAST2SMS_API_KEY,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            route: "otp",
            variables_values: otp,
            numbers: phone
          })
        });
        const data = await response.json();
        console.log(`[SMS:Fast2SMS] Dispatched OTP to ${phone}:`, data);
        return { success: true, provider: "fast2sms" };
      } catch (err) {
        console.error("[SMS:Fast2SMS] Failed to send SMS:", err.message);
        throw new Error("Failed to send OTP via SMS provider. Please try again.");
      }
    }

    if (ENV.SMS_PROVIDER === "twilio" && ENV.TWILIO_ACCOUNT_SID && ENV.TWILIO_AUTH_TOKEN) {
      try {
        const auth = Buffer.from(`${ENV.TWILIO_ACCOUNT_SID}:${ENV.TWILIO_AUTH_TOKEN}`).toString("base64");
        const body = new URLSearchParams({
          To: phone.startsWith("+") ? phone : `+91${phone}`,
          From: ENV.TWILIO_PHONE_NUMBER,
          Body: message
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
        console.log(`[SMS:Twilio] Dispatched OTP to ${phone}:`, data.sid || data.message);
        return { success: true, provider: "twilio" };
      } catch (err) {
        console.error("[SMS:Twilio] Failed to send SMS:", err.message);
        throw new Error("Failed to send OTP via Twilio SMS. Please try again.");
      }
    }

    // Clean, readable Windows-compatible terminal output
    console.log("==================================================");
    console.log(`[OJASWI LOGIN TERMINAL - SMS VERIFICATION CODE]`);
    console.log(`>> Mobile Number:     +91 ${phone}`);
    console.log(`>> Verification Code: ${otp}`);
    console.log(`>> Valid For:         30 minutes`);
    console.log(`>> Quick Auto-Fill:   Ready on website`);
    console.log("==================================================");
    return { success: true, provider: "console_simulation" };
  },

  /**
   * Sends an Order Notification SMS to company owner or customer
   */
  async sendOrderSms(phone, orderId, customerName, total, paymentMethod) {
    const text = `New Ojaswi Order ${orderId}! Customer: ${customerName}, Total: Rs.${total}, Payment: ${paymentMethod}. Ojaswi Foods Malegaon.`;

    if (ENV.SMS_PROVIDER === "fast2sms" && ENV.FAST2SMS_API_KEY) {
      try {
        await fetch("https://www.fast2sms.com/dev/bulkV2", {
          method: "POST",
          headers: {
            authorization: ENV.FAST2SMS_API_KEY,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            route: "q",
            message: text,
            language: "english",
            numbers: phone
          })
        });
      } catch (err) {
        console.warn("[SMS] Order SMS notification error:", err.message);
      }
      return;
    }

    console.log(`[SMS Notification] Order ${orderId} sent to ${phone}: ${text}`);
  }
};
