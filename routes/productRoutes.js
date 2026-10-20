import express from "express";
import { db } from "../config/db.js";
import { Product } from "../models/index.js";

const router = express.Router();

/**
 * GET /api/products
 * Public catalog of all active Ojaswi products from MongoDB Atlas
 */
router.get("/", async (req, res, next) => {
  try {
    let products = null;
    try {
      if (Product.db?.readyState === 1) {
        products = await Product.find({ is_active: 1 }).sort({ id: 1 }).lean();
      }
    } catch (_) {}

    if (!products || products.length === 0) {
      products = await db.all(
        `SELECT id, name, slug, product_number, sku, category, location, description, 
                price, mrp, selling_price, weight, image, image_backup, images_json, stock, is_active 
         FROM products 
         WHERE is_active = 1 
         ORDER BY id ASC`
      );
    }

    const formatted = products.map((p) => {
      let images = p.images || [];
      if (!images || images.length === 0) {
        try {
          images = p.images_json ? JSON.parse(p.images_json) : [p.image];
        } catch {
          images = [p.image];
        }
      }
      return {
        ...p,
        images
      };
    });

    res.json({
      success: true,
      count: formatted.length,
      products: formatted
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/products/:idOrSlug
 * Retrieve single product by numeric ID or URL slug from MongoDB Atlas
 */
router.get("/:idOrSlug", async (req, res, next) => {
  try {
    const { idOrSlug } = req.params;
    let product = null;

    if (/^\d+$/.test(idOrSlug)) {
      const numId = parseInt(idOrSlug, 10);
      try {
        if (Product.db?.readyState === 1) {
          product = await Product.findOne({ id: numId, is_active: 1 }).lean();
        }
      } catch (_) {}
      if (!product) {
        product = await db.get("SELECT * FROM products WHERE id = $1 AND is_active = 1", [numId]);
      }
    } else {
      try {
        if (Product.db?.readyState === 1) {
          product = await Product.findOne({ slug: idOrSlug, is_active: 1 }).lean();
        }
      } catch (_) {}
      if (!product) {
        product = await db.get("SELECT * FROM products WHERE slug = $1 AND is_active = 1", [idOrSlug]);
      }
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        error: "Product not found."
      });
    }

    let images = product.images || [];
    if (!images || images.length === 0) {
      try {
        images = product.images_json ? JSON.parse(product.images_json) : [product.image];
      } catch {
        images = [product.image];
      }
    }

    res.json({
      success: true,
      product: {
        ...product,
        images
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
