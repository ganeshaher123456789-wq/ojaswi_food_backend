import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema({
  product_id: { type: Number, required: true },
  product_name: { type: String, required: true },
  selling_price: { type: Number, required: true },
  price: { type: Number },
  weight: { type: String, default: "NET WEIGHT 500g" },
  image: { type: String },
  sku: { type: String },
  quantity: { type: Number, default: 1, min: 1, max: 100 }
});

const cartSchema = new mongoose.Schema(
  {
    user_id: { type: Number, index: true },
    session_id: { type: String, index: true },
    items: [cartItemSchema],
    subtotal: { type: Number, default: 0 },
    total_items: { type: Number, default: 0 }
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
  }
);

export const Cart = mongoose.models.Cart || mongoose.model("Cart", cartSchema, "carts");
export default Cart;
