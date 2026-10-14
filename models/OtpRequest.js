import mongoose from "mongoose";

const otpRequestSchema = new mongoose.Schema(
  {
    identifier: { type: String, required: true, index: true },
    type: { type: String, enum: ["phone", "email"], required: true },
    otp_hash: { type: String, required: true },
    expires_at: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    is_verified: { type: Number, default: 0 }
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: false }
  }
);

export const OtpRequest = mongoose.models.OtpRequest || mongoose.model("OtpRequest", otpRequestSchema);
export default OtpRequest;
