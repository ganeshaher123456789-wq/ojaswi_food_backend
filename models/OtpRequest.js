import mongoose from "mongoose";

const otpRequestSchema = new mongoose.Schema(
  {
    id: { type: Number },
    identifier: { type: String, required: true, index: true },
    type: { type: String, enum: ["phone", "email"], required: true },
    otp_hash: { type: String, required: true },
    expires_at: { type: Date, required: true, index: true },
    attempts: { type: Number, default: 0 },
    is_verified: { type: Number, default: 0, index: true },
    ip_address: { type: String }
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
  }
);

otpRequestSchema.index({ identifier: 1, is_verified: 1, expires_at: -1 });

export const OtpRequest = mongoose.models.OtpRequest || mongoose.model("OtpRequest", otpRequestSchema, "otp_requests");
export default OtpRequest;
