import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    phone: { type: String, trim: true, index: true },
    email: { type: String, trim: true, lowercase: true, index: true },
    name: { type: String, trim: true },
    role: { type: String, default: "customer", enum: ["customer", "admin"] }
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
  }
);

export const User = mongoose.models.User || mongoose.model("User", userSchema);
export default User;
