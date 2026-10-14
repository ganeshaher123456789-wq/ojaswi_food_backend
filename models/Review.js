import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    product_id: { type: Number, required: true, index: true },
    user_id: { type: Number },
    order_id: { type: String },
    customer_name: { type: String, required: true },
    customer_phone: { type: String },
    rating: { type: Number, required: true, min: 1, max: 5 },
    review_title: { type: String },
    review_text: { type: String },
    image_url: { type: String },
    verified_purchase: { type: Number, default: 1 },
    is_approved: { type: Number, default: 1, index: true }
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
  }
);

export const Review = mongoose.models.Review || mongoose.model("Review", reviewSchema);
export default Review;
