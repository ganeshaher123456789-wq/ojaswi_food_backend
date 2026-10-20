import express from "express";
import { db } from "../config/db.js";
import { Order, Payment, Product } from "../models/index.js";
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
    let order = await db.get("SELECT * FROM orders WHERE id = $1", [cleanOrderId]);
    if (!order) {
      try {
        order = await Order.findOne({ id: cleanOrderId }).lean();
      } catch (_) {}
    }

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

    // Update Payments record in SQL & MongoDB Atlas
    await db.run(
      `UPDATE payments 
       SET gateway_payment_id = $1, gateway_signature = $2, status = 'Captured' 
       WHERE gateway_order_id = $3`,
      [razorpay_payment_id, razorpay_signature, razorpay_order_id]
    );

    try {
      await Payment.findOneAndUpdate(
        { gateway_order_id: razorpay_order_id },
        {
          order_id: cleanOrderId,
          gateway_payment_id: razorpay_payment_id,
          gateway_signature: razorpay_signature,
          status: "Captured",
          updated_at: new Date()
        },
        { upsert: true, returnDocument: "after" }
      );
    } catch (mErr) {
      console.warn("[MongoDB] Payment update notice:", mErr.message);
    }

    // Update Order record in SQL & MongoDB Atlas
    await db.run(
      `UPDATE orders 
       SET payment_status = $1, order_status = 'Confirmed', updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [OJASWI_CONSTANTS.PAYMENT_STATUSES.PAID, cleanOrderId]
    );

    try {
      await Order.findOneAndUpdate(
        { id: cleanOrderId },
        {
          payment_status: OJASWI_CONSTANTS.PAYMENT_STATUSES.PAID,
          order_status: "Confirmed",
          updated_at: new Date()
        }
      );
    } catch (mErr) {
      console.warn("[MongoDB] Order status update notice:", mErr.message);
    }

    // Decrement inventory stock now that online payment is verified
    let items = order.items && order.items.length > 0 ? order.items : [];
    if (items.length === 0) {
      items = await db.all("SELECT * FROM order_items WHERE order_id = $1", [cleanOrderId]);
    }

    for (const item of items) {
      const pId = item.product_id || item.productId;
      await db.run(
        "UPDATE products SET stock = MAX(0, stock - $1) WHERE id = $2",
        [item.quantity, pId]
      );
      try {
        await Product.findOneAndUpdate(
          { id: pId },
          { $inc: { stock: -item.quantity } }
        );
      } catch (_) {}
    }

    let updatedOrder = await db.get("SELECT * FROM orders WHERE id = $1", [cleanOrderId]);
    if (!updatedOrder) {
      try {
        updatedOrder = await Order.findOne({ id: cleanOrderId }).lean();
      } catch (_) {}
    }

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
