import express from "express";
import { Category, Product } from "../models/index.js";
import { requireAdmin } from "../middleware/auth.js";

const router = express.Router();

export const CATEGORY_METADATA = [
  { id: 1, name: "Blended Masala", slug: "blended-masala", description: "Traditional roasted aromatic whole spice blends for rich authentic curries.", image: "images/garam-masala.jpeg", is_active: 1 },
  { id: 2, name: "Curry & Gravy Special", slug: "curry-gravy-special", description: "All-in-one royal masala for luscious restaurant-style vegetable and paneer gravies.", image: "images/kitchen-king.jpeg", is_active: 1 },
  { id: 3, name: "Everyday Sabji", slug: "everyday-sabji", description: "Everyday wholesome spice blend with appetizing golden color and balanced aroma.", image: "images/sabji-masala.jpeg", is_active: 1 },
  { id: 4, name: "Snack & Chaat Spices", slug: "snack-chaat-spices", description: "Zesty, tangy black salt and roasted cumin sprinkles for street foods and salads.", image: "images/chaat-masala.jpeg", is_active: 1 },
  { id: 5, name: "Royal Rice & Biryani", slug: "royal-rice-biryani", description: "Fragrant exotic spice blend infused with shahi jeera, star anise, mace and cardamom.", image: "images/biryani-masala.jpeg", is_active: 1 },
  { id: 6, name: "Speciality Masala", slug: "speciality-masala", description: "Authentic regional Maharashtrian specialties including Pav Bhaji, Misal, and Chhole masalas.", image: "images/misal-masala.jpeg", is_active: 1 },
  { id: 7, name: "Authentic Spices", slug: "authentic-spices", description: "Single-origin stone-ground spices processed at Malegaon 423203 facility.", image: "images/garam-masala.jpeg", is_active: 1 }
];

/**
 * GET /api/categories
 * Public endpoint to list all spice product categories
 */
router.get("/", async (req, res, next) => {
  try {
    let categories = [];
    try {
      if (Category.db?.readyState === 1) {
        categories = await Category.find({ is_active: 1 }).sort({ id: 1 }).lean();
      }
    } catch (_) {}

    // If categories collection is empty in MongoDB Atlas, auto-populate from CATEGORY_METADATA
    if (!categories || categories.length === 0) {
      try {
        if (Category.db?.readyState === 1) {
          for (const cat of CATEGORY_METADATA) {
            await Category.findOneAndUpdate(
              { slug: cat.slug },
              cat,
              { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
            );
          }
          categories = await Category.find({ is_active: 1 }).sort({ id: 1 }).lean();
        }
      } catch (_) {}
    }

    if (!categories || categories.length === 0) {
      categories = [...CATEGORY_METADATA];
    }

    // Dynamically compute live active product count for each category
    const categoriesWithCount = await Promise.all(
      categories.map(async (c) => {
        let count = 0;
        try {
          if (Product.db?.readyState === 1) {
            count = await Product.countDocuments({ category: c.name, is_active: 1 });
          }
        } catch (_) {}
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
    let category = null;
    try {
      if (Category.db?.readyState === 1) {
        category = await Category.findOne({ slug, is_active: 1 }).lean();
      }
    } catch (_) {}

    if (!category) {
      category = CATEGORY_METADATA.find(c => c.slug === slug);
    }

    if (!category) {
      return res.status(404).json({
        success: false,
        error: `Category '${slug}' not found.`
      });
    }

    let products = [];
    try {
      if (Product.db?.readyState === 1) {
        products = await Product.find({ category: category.name, is_active: 1 })
          .sort({ id: 1 })
          .lean();
      }
    } catch (_) {}

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
