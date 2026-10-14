import express from "express";
import { db } from "../config/db.js";
import { paymentService } from "../services/paymentService.js";
import { notificationService } from "../services/notificationService.js";
import { OJASWI_CONSTANTS } from "../config/constants.js";

const router = express.Router();

/**
 * POST /api/payments/verify
 * Server-side cryptographic HMAC-SHA256 verification of Razorpay payment
 */
router.post("/verify", async (req, res, next) => {
  try {
    const {
      order_id,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;

    if (!order_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        error: "Missing required payment verification details."
      });
    }

    const cleanOrderId = order_id.startsWith("#") ? order_id : `#${order_id}`;
    const order = await db.get("SELECT * FROM orders WHERE id = $1", [cleanOrderId]);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: `Order ${cleanOrderId} not found.`
      });
    }

    // Cryptographic signature check
    paymentService.verifySignature({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    });

    // Update Payments record
    await db.run(
      `UPDATE payments 
       SET gateway_payment_id = $1, gateway_signature = $2, status = 'Captured' 
       WHERE gateway_order_id = $3`,
      [razorpay_payment_id, razorpay_signature, razorpay_order_id]
    );

    // Update Order record
    await db.run(
      `UPDATE orders 
       SET payment_status = $1, order_status = 'Confirmed', updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [OJASWI_CONSTANTS.PAYMENT_STATUSES.PAID, cleanOrderId]
    );

    // Decrement inventory stock now that online payment is verified
    const items = await db.all("SELECT * FROM order_items WHERE order_id = $1", [cleanOrderId]);
    for (const item of items) {
      await db.run(
        "UPDATE products SET stock = MAX(0, stock - $1) WHERE id = $2",
        [item.quantity, item.product_id]
      );
    }

    const updatedOrder = await db.get("SELECT * FROM orders WHERE id = $1", [cleanOrderId]);

    // Dispatch multi-channel owner and customer notifications
    notificationService.notifyOrderPlaced(updatedOrder, items).catch(console.error);

    res.json({
      success: true,
      message: "Payment verified successfully! Your order is confirmed.",
      orderId: cleanOrderId,
      paymentId: razorpay_payment_id
    });
  } catch (err) {
    console.error("[Payment:Verify] Error:", err.message);
    res.status(400).json({
      success: false,
      error: err.message || "Payment verification failed."
    });
  }
});

export default router;
