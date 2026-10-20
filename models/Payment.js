import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    id: { type: Number },
    order_id: { type: String, required: true, index: true },
    payment_method: { type: String, required: true },
    gateway: { type: String, required: true, default: "Razorpay" },
    gateway_order_id: { type: String, index: true },
    gateway_payment_id: { type: String, index: true },
    gateway_signature: { type: String },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    status: { type: String, required: true, index: true },
    raw_response: { type: mongoose.Schema.Types.Mixed }
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
  }
);

export const Payment = mongoose.models.Payment || mongoose.model("Payment", paymentSchema, "payments");
export default Payment;
