import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    id: { type: Number, index: true },
    phone: { type: String, trim: true, index: true },
    email: { type: String, trim: true, lowercase: true, index: true },
    name: { type: String, trim: true, required: true },
    google_id: { type: String, trim: true, index: true },
    google_picture: { type: String, trim: true },
    password_hash: { type: String },
    role: { type: String, default: "customer", enum: ["customer", "admin"], index: true },
    delivery_address: {
      flat_house: { type: String, trim: true },
      area_street: { type: String, trim: true },
      city: { type: String, trim: true },
      district: { type: String, trim: true },
      state: { type: String, trim: true },
      pincode: { type: String, trim: true }
    },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    pincode: { type: String, trim: true },
    total_orders: { type: Number, default: 0 },
    total_spent: { type: Number, default: 0 },
    last_order_id: { type: String, trim: true },
    last_order_date: { type: Date },
    last_login: { type: Date },
    is_active: { type: Boolean, default: true }
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
  }
);

// Compound indexes for fast lookups
userSchema.index({ phone: 1, role: 1 });
userSchema.index({ email: 1, role: 1 });
userSchema.index({ role: 1, created_at: -1 });

export const User = mongoose.models.User || mongoose.model("User", userSchema, "users");
export default User;
