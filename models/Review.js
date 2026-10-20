import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    id: { type: Number, index: true },
    product_id: { type: Number, required: true, index: true },
    product_name: { type: String },
    user_id: { type: Number },
    order_id: { type: String },
    customer_name: { type: String, required: true },
    customer_phone: { type: String },
    rating: { type: Number, required: true, min: 1, max: 5 },
    review_title: { type: String },
    review_text: { type: String },
    image_url: { type: String },
    is_verified_buyer: { type: Number, default: 1 },
    is_approved: { type: Number, default: 1, index: true }
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
  }
);

reviewSchema.index({ product_id: 1, is_approved: 1, created_at: -1 });

export const Review = mongoose.models.Review || mongoose.model("Review", reviewSchema, "reviews");
export default Review;
