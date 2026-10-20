import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    id: { type: Number },
    order_id: { type: String, index: true },
    channel: { type: String, required: true },
    recipient: { type: String, required: true },
    payload: { type: String },
    status: { type: String, default: "pending" },
    error_message: { type: String },
    sent_at: { type: Date }
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: false }
  }
);

export const Notification = mongoose.models.Notification || mongoose.model("Notification", notificationSchema, "notifications");
export default Notification;
