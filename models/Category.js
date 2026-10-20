import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    id: { type: Number, index: true },
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, index: true },
    description: { type: String },
    image: { type: String },
    product_count: { type: Number, default: 0 },
    is_active: { type: Number, default: 1, index: true }
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
  }
);

export const Category = mongoose.models.Category || mongoose.model("Category", categorySchema, "categories");
export default Category;
