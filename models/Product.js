import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true, required: true },
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, index: true },
    product_number: { type: String },
    sku: { type: String, index: true },
    category: { type: String, default: "Authentic Spices", index: true },
    location: { type: String, default: "52/2, Malegaon - 423203, Nashik, Maharashtra, India" },
    description: { type: String },
    price: { type: Number, required: true },
    mrp: { type: Number },
    selling_price: { type: Number, required: true },
    weight: { type: String, default: "NET WEIGHT 500g" },
    image: { type: String, required: true },
    image_backup: { type: String },
    images: [{ type: String }],
    images_json: { type: String },
    stock: { type: Number, default: 100 },
    is_active: { type: Number, default: 1, index: true }
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
  }
);

export const Product = mongoose.models.Product || mongoose.model("Product", productSchema, "products");
export default Product;
