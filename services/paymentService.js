import crypto from "crypto";
import Razorpay from "razorpay";
import { ENV } from "../config/env.js";

let razorpayInstance = null;

function getRazorpayInstance() {
  if (razorpayInstance) return razorpayInstance;
  if (ENV.RAZORPAY_KEY_ID && ENV.RAZORPAY_KEY_SECRET) {
    razorpayInstance = new Razorpay({
      key_id: ENV.RAZORPAY_KEY_ID,
      key_secret: ENV.RAZORPAY_KEY_SECRET
    });
  }
  return razorpayInstance;
}

export const paymentService = {
  /**
   * Creates a Razorpay Order on the official server SDK
   */
  async createOrder(amountInRupees, orderId) {
    const amountInPaise = Math.round(amountInRupees * 100);
    const instance = getRazorpayInstance();

    if (instance) {
      try {
        const options = {
          amount: amountInPaise,
          currency: "INR",
          receipt: orderId.replace("#", ""),
          notes: {
            brand: "Ojaswi Premium",
            location: "52/2 Malegaon 423203"
          }
        };
        const order = await instance.orders.create(options);
        return {
          id: order.id,
          amount: order.amount,
          currency: order.currency,
          keyId: ENV.RAZORPAY_KEY_ID
        };
      } catch (err) {
        console.error("[Razorpay] Failed to create order:", err.message);
        throw new Error("Payment gateway communication error. Please try again.");
      }
    }

    // Development fallback when credentials not provided
    console.log(`[Razorpay:Dev] Generating development simulated payment order for ₹${amountInRupees}`);
    const simulatedOrderId = `order_dev_${crypto.randomBytes(8).toString("hex")}`;
    return {
      id: simulatedOrderId,
      amount: amountInPaise,
      currency: "INR",
      keyId: "rzp_test_simulated_dev",
      simulated: true
    };
  },

  /**
   * Cryptographically verifies the HMAC-SHA256 signature from Razorpay
   */
  verifySignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw new Error("Missing required payment verification parameters.");
    }

    // If simulated order in development mode
    if (razorpay_order_id.startsWith("order_dev_") && !ENV.RAZORPAY_KEY_SECRET) {
      console.log("[Razorpay:Dev] Verified simulated payment in development mode.");
      return true;
    }

    if (!ENV.RAZORPAY_KEY_SECRET) {
      throw new Error("Razorpay key secret not configured on server.");
    }

    const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", ENV.RAZORPAY_KEY_SECRET)
      .update(payload)
      .digest("hex");

    const expectedBuf = Buffer.from(expectedSignature, "utf-8");
    const receivedBuf = Buffer.from(razorpay_signature, "utf-8");

    if (
      expectedBuf.length !== receivedBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, receivedBuf)
    ) {
      throw new Error("Payment verification failed. Invalid gateway signature.");
    }

    return true;
  }
};
