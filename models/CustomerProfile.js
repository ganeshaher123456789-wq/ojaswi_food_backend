import mongoose from "mongoose";

const customerProfileSchema = new mongoose.Schema(
  {
    user_id: { type: Number, required: true, unique: true, index: true },
    default_address_id: { type: Number },
    avatar_url: { type: String },
    notes: { type: String }
  },
  {
    timestamps: { createdAt: false, updatedAt: "updated_at" }
  }
);

export const CustomerProfile = mongoose.models.CustomerProfile || mongoose.model("CustomerProfile", customerProfileSchema);
export default CustomerProfile;
