import express from "express";
import { Category, Product } from "../models/index.js";
import { requireAdmin } from "../middleware/auth.js";

const router = express.Router();

/**
 * GET /api/categories
 * Public endpoint to list all spice product categories
 */
router.get("/", async (req, res, next) => {
  try {
    const categories = await Category.find({ is_active: 1 }).sort({ id: 1 }).lean();

    // Dynamically compute live active product count for each category
    const categoriesWithCount = await Promise.all(
      categories.map(async (c) => {
        const count = await Product.countDocuments({ category: c.name, is_active: 1 });
        return {
          ...c,
          product_count: count
        };
      })
    );

    res.json({
      success: true,
      count: categoriesWithCount.length,
      categories: categoriesWithCount
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/categories/:slug
 * Retrieve single category and its matching products
 */
router.get("/:slug", async (req, res, next) => {
  try {
    const { slug } = req.params;
    const category = await Category.findOne({ slug, is_active: 1 }).lean();

    if (!category) {
      return res.status(404).json({
        success: false,
        error: `Category '${slug}' not found.`
      });
    }

    const products = await Product.find({ category: category.name, is_active: 1 })
      .sort({ id: 1 })
      .lean();

    res.json({
      success: true,
      category,
      products
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/categories (Admin Only)
 * Create new category in MongoDB Atlas
 */
router.post("/", requireAdmin, async (req, res, next) => {
  try {
    const { name, description, image } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: "Category name is required." });
    }

    const cleanName = name.trim();
    const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

    const count = await Category.countDocuments();
    const newCat = await Category.create({
      id: count + 1,
      name: cleanName,
      slug,
      description: description?.trim() || "",
      image: image?.trim() || "images/garam-masala.jpeg",
      is_active: 1
    });

    res.status(201).json({
      success: true,
      message: "Category created successfully in MongoDB Atlas.",
      category: newCat
    });
  } catch (err) {
    next(err);
  }
});

export default router;
