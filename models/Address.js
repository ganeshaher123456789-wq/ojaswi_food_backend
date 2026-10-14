import mongoose from "mongoose";

const addressSchema = new mongoose.Schema(
  {
    user_id: { type: Number, required: true, index: true },
    full_name: { type: String, required: true },
    phone: { type: String, required: true },
    flat_house: { type: String, required: true },
    area_street: { type: String, required: true },
    city: { type: String, required: true },
    district: { type: String },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    is_default: { type: Number, default: 0 }
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
  }
);

export const Address = mongoose.models.Address || mongoose.model("Address", addressSchema);
export default Address;
