import { ENV } from "../config/env.js";

export const smsService = {
  /**
   * Sends an OTP via SMS to an Indian mobile number
   */
  async sendOtpSms(phone, otp) {
    const message = `Your Ojaswi Premium verification code is: ${otp}. Valid for ${ENV.OTP_EXPIRY_MINUTES} minutes. Do not share this with anyone. - Ojaswi Foods Malegaon`;

    if (ENV.SMS_PROVIDER === "fast2sms") {
      if (!ENV.FAST2SMS_API_KEY) {
        throw new Error("Fast2SMS API key is not configured.");
      }
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
        if (!response.ok || data.return === false) {
          throw new Error(data.message || "Fast2SMS rejected OTP request.");
        }
        console.log(`[SMS:Fast2SMS] Dispatched OTP to ${phone}:`, data);
        return { success: true, provider: "fast2sms" };
      } catch (err) {
        console.error("[SMS:Fast2SMS] Failed to send SMS:", err.message);
        throw new Error(`Failed to send OTP via SMS provider: ${err.message}`);
      }
    }

    if (ENV.SMS_PROVIDER === "twilio") {
      if (!ENV.TWILIO_ACCOUNT_SID || !ENV.TWILIO_AUTH_TOKEN || !ENV.TWILIO_PHONE_NUMBER) {
        throw new Error("Twilio credentials (SID, token, phone number) are not fully configured.");
      }
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
        if (!response.ok) {
          throw new Error(data.message || `Twilio error code ${data.code}`);
        }
        console.log(`[SMS:Twilio] Dispatched OTP to ${phone}:`, data.sid);
        return { success: true, provider: "twilio" };
      } catch (err) {
        console.error("[SMS:Twilio] Failed to send SMS:", err.message);
        throw new Error(`Failed to send OTP via Twilio SMS: ${err.message}`);
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
   * Helper to dispatch SMS via configured provider with strict status reporting
   */
  async _dispatchSms(phone, text) {
    if (ENV.SMS_PROVIDER === "fast2sms") {
      if (!ENV.FAST2SMS_API_KEY) {
        throw new Error("Fast2SMS API key is not configured.");
      }
      const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
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
      const data = await response.json();
      if (!response.ok || data.return === false) {
        throw new Error(data.message || "Fast2SMS rejected message dispatch.");
      }
      console.log(`[SMS:Fast2SMS] Sent SMS to ${phone}`);
      return { success: true, provider: "fast2sms", data };
    }

    if (ENV.SMS_PROVIDER === "twilio") {
      if (!ENV.TWILIO_ACCOUNT_SID || !ENV.TWILIO_AUTH_TOKEN || !ENV.TWILIO_PHONE_NUMBER) {
        throw new Error("Twilio credentials (SID, token, phone number) are not fully configured.");
      }
      const auth = Buffer.from(`${ENV.TWILIO_ACCOUNT_SID}:${ENV.TWILIO_AUTH_TOKEN}`).toString("base64");
      const recipient = phone.startsWith("+") ? phone : `+91${phone}`;
      const body = new URLSearchParams({
        To: recipient,
        From: ENV.TWILIO_PHONE_NUMBER,
        Body: text
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
      if (!response.ok) {
        throw new Error(data.message || `Twilio error code ${data.code}`);
      }
      console.log(`[SMS:Twilio] Sent SMS to ${phone}`);
      return { success: true, provider: "twilio", data };
    }

    console.log(`[SMS:Console] Sent message to ${phone}: ${text}`);
    return { success: true, provider: "console_simulation" };
  },

  /**
   * Sends Order Confirmation SMS to the customer
   */
  async sendCustomerOrderSms(phone, orderId, customerName, total, paymentMethod) {
    const isCOD = !paymentMethod || paymentMethod.toLowerCase().includes("cash") || paymentMethod.toLowerCase().includes("cod");
    const payStatusStr = isCOD ? "Payment Pending — Cash on Delivery" : paymentMethod;
    const text = `Namaste ${customerName}, your Ojaswi Foods order ${orderId} for Rs.${total} is confirmed! Status: ${payStatusStr}. Fast dispatch from Malegaon 423203. Support: +91 7620098478.`;
    return this._dispatchSms(phone, text);
  },

  /**
   * Sends Order Notification SMS to company owner
   */
  async sendOrderSms(phone, orderId, customerName, total, paymentMethod) {
    const text = `New Ojaswi Order ${orderId}! Customer: ${customerName}, Total: Rs.${total}, Payment: ${paymentMethod}. Ojaswi Foods Malegaon.`;
    return this._dispatchSms(phone, text);
  }
};
