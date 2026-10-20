import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
  product_id: { type: Number, required: true },
  product_name: { type: String, required: true },
  product_image: { type: String },
  product_location: { type: String },
  sku: { type: String },
  unit_price: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  total_price: { type: Number, required: true }
});

const deliveryAddressSchema = new mongoose.Schema(
  {
    flat_house: { type: String, trim: true },
    area_street: { type: String, trim: true },
    city: { type: String, trim: true },
    district: { type: String, trim: true },
    state: { type: String, trim: true },
    pincode: { type: String, trim: true }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    user_id: { type: Number, index: true },
    customer_name: { type: String, required: true, trim: true },
    customer_phone: { type: String, required: true, trim: true, index: true },
    customer_email: { type: String, trim: true, lowercase: true },
    subtotal: { type: Number, required: true },
    delivery_charge: { type: Number, default: 0 },
    discount_amount: { type: Number, default: 0 },
    total_amount: { type: Number, required: true },
    payment_method: { type: String, required: true },
    payment_status: { type: String, default: "Payment Pending", index: true },
    order_status: { 
      type: String, 
      default: "Pending", 
      index: true 
    },
    delivery_address: { type: mongoose.Schema.Types.Mixed },
    delivery_address_json: { type: String },
    items: [orderItemSchema],
    notes: { type: String, trim: true },
    tracking_note: { type: String, trim: true },
    delivery_spot: { type: String, trim: true },
    dispatched_at: { type: Date },
    delivered_at: { type: Date }
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
  }
);

// Compound indexes for fast lookups & filtering
orderSchema.index({ customer_phone: 1, created_at: -1 });
orderSchema.index({ user_id: 1, created_at: -1 });
orderSchema.index({ order_status: 1, created_at: -1 });
orderSchema.index({ created_at: -1 });

export const Order = mongoose.models.Order || mongoose.model("Order", orderSchema, "orders");
export default Order;
