import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
  product_id: { type: Number },
  product_name: { type: String, required: true },
  product_image: { type: String },
  product_location: { type: String },
  sku: { type: String },
  unit_price: { type: Number, required: true },
  quantity: { type: Number, required: true },
  total_price: { type: Number, required: true }
});

const orderSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    user_id: { type: Number, index: true },
    customer_name: { type: String, required: true },
    customer_phone: { type: String, required: true, index: true },
    customer_email: { type: String },
    subtotal: { type: Number, required: true },
    delivery_charge: { type: Number, default: 0 },
    discount_amount: { type: Number, default: 0 },
    total_amount: { type: Number, required: true },
    payment_method: { type: String, required: true },
    payment_status: { type: String, default: "Payment Pending" },
    order_status: { type: String, default: "Order Placed", index: true },
    delivery_address: { type: mongoose.Schema.Types.Mixed },
    delivery_address_json: { type: String },
    items: [orderItemSchema],
    notes: { type: String },
    tracking_note: { type: String },
    delivery_spot: { type: String },
    dispatched_at: { type: Date },
    delivered_at: { type: Date }
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
  }
);

export const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);
export default Order;
