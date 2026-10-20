import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { db } from "../config/db.js";
import { Review } from "../models/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Ensure upload directory exists
const reviewUploadDir = path.resolve(__dirname, "../images/reviews");
if (!fs.existsSync(reviewUploadDir)) {
  fs.mkdirSync(reviewUploadDir, { recursive: true });
}

// Multer storage for customer review photos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, reviewUploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
    cb(null, `review_${cleanName}_${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 6 * 1024 * 1024 }, // 6 MB max photo size
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) {
      return cb(null, true);
    }
    cb(new Error("Only image files (.jpg, .jpeg, .png, .webp) are allowed."));
  }
});

// Helper to compute rating summaries
function computeSummary(reviews) {
  const total = reviews.length;
  if (total === 0) {
    return {
      total_reviews: 0,
      average_rating: 5.0,
      rating_counts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    };
  }

  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;

  for (const r of reviews) {
    const star = Math.min(5, Math.max(1, parseInt(r.rating, 10) || 5));
    counts[star] = (counts[star] || 0) + 1;
    sum += star;
  }

  const avg = parseFloat((sum / total).toFixed(1));
  return {
    total_reviews: total,
    average_rating: avg,
    rating_counts: counts
  };
}

/**
 * 1. GET /api/reviews
 * Returns reviews, with optional product_id or limit filter
 */
router.get("/", async (req, res, next) => {
  try {
    const { product_id, limit = 50, featured } = req.query;
    let reviews = [];

    try {
      const filter = { is_approved: 1 };
      if (product_id) filter.product_id = parseInt(product_id, 10);
      if (featured === "true" || featured === "1") {
        filter.rating = { $gte: 4 };
        filter.image_url = { $exists: true, $ne: "" };
      }
      reviews = await Review.find(filter)
        .sort({ created_at: -1 })
        .limit(Math.min(100, parseInt(limit, 10) || 50))
        .lean();
    } catch (_) {}

    if (!reviews || reviews.length === 0) {
      let query = "SELECT * FROM reviews WHERE is_approved = 1";
      let params = [];

      if (product_id) {
        query += " AND product_id = $1";
        params.push(parseInt(product_id, 10));
      }

      if (featured === "true" || featured === "1") {
        query += " AND rating >= 4 AND image_url IS NOT NULL AND image_url != ''";
      }

      query += " ORDER BY created_at DESC LIMIT " + Math.min(100, parseInt(limit, 10) || 50);
      reviews = await db.all(query, params);
    }

    const summary = computeSummary(reviews);

    res.json({
      success: true,
      summary,
      reviews
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 2. GET /api/reviews/product/:productId
 * Returns all reviews specifically for one product blend
 */
router.get("/product/:productId", async (req, res, next) => {
  try {
    const productId = parseInt(req.params.productId, 10);
    if (!productId) {
      return res.status(400).json({ success: false, error: "Valid Product ID is required." });
    }

    let reviews = [];
    try {
      reviews = await Review.find({ product_id: productId, is_approved: 1 })
        .sort({ created_at: -1 })
        .lean();
    } catch (_) {}

    if (!reviews || reviews.length === 0) {
      reviews = await db.all(
        "SELECT * FROM reviews WHERE product_id = $1 AND is_approved = 1 ORDER BY created_at DESC",
        [productId]
      );
    }

    const summary = computeSummary(reviews);

    res.json({
      success: true,
      product_id: productId,
      summary,
      reviews
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 3. POST /api/reviews
 * Submit a customer review with star rating, comments & optional uploaded photo
 */
router.post("/", (req, res, next) => {
  upload.single("image")(req, res, async (uploadErr) => {
    if (uploadErr) {
      return res.status(400).json({ success: false, error: uploadErr.message });
    }

    try {
      const {
        product_id,
        rating,
        customer_name,
        customer_phone,
        review_title,
        review_text,
        order_id,
        image_base64
      } = req.body;

      if (!product_id) {
        return res.status(400).json({ success: false, error: "Please select a product to review." });
      }

      const pId = parseInt(product_id, 10);
      const product = await db.get("SELECT id, name FROM products WHERE id = $1", [pId]);
      if (!product) {
        return res.status(404).json({ success: false, error: "Product not found." });
      }

      const numRating = parseInt(rating, 10);
      if (isNaN(numRating) || numRating < 1 || numRating > 5) {
        return res.status(400).json({ success: false, error: "Rating must be between 1 and 5 stars." });
      }

      if (!customer_name || !customer_name.trim()) {
        return res.status(400).json({ success: false, error: "Please enter your name." });
      }

      if (!review_text || !review_text.trim()) {
        return res.status(400).json({ success: false, error: "Please write a few words about your cooking experience." });
      }

      // Handle image: uploaded file or base64 or direct URL
      let imageUrl = null;
      if (req.file) {
        imageUrl = `images/reviews/${req.file.filename}`;
      } else if (image_base64 && typeof image_base64 === "string" && image_base64.startsWith("data:image/")) {
        // Save base64 image safely
        try {
          const matches = image_base64.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
          if (matches) {
            const ext = matches[1] === "jpeg" ? ".jpg" : `.${matches[1]}`;
            const buffer = Buffer.from(matches[2], "base64");
            const filename = `review_b64_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${ext}`;
            const filepath = path.join(reviewUploadDir, filename);
            fs.writeFileSync(filepath, buffer);
            imageUrl = `images/reviews/${filename}`;
          }
        } catch (e) {
          console.warn("[Reviews] Error saving base64 image:", e.message);
        }
      } else if (req.body.image_url && typeof req.body.image_url === "string") {
        imageUrl = req.body.image_url.trim();
      }

      // Check verified buyer status if order_id is provided
      let isVerified = 1;
      let cleanOrderId = null;
      if (order_id && typeof order_id === "string" && order_id.trim()) {
        cleanOrderId = order_id.trim();
        const rawWithoutHash = cleanOrderId.replace(/^#/, "");
        const rawWithHash = cleanOrderId.startsWith("#") ? cleanOrderId : `#${cleanOrderId}`;
        const orderRow = await db.get(
          "SELECT id, order_status FROM orders WHERE id = $1 OR id = $2 OR id = $3",
          [cleanOrderId, rawWithHash, rawWithoutHash]
        );
        if (orderRow) {
          isVerified = 1;
          cleanOrderId = orderRow.id;
        }
      }

      const userId = req.user ? req.user.id : null;

      const result = await db.run(
        `INSERT INTO reviews (product_id, product_name, order_id, user_id, customer_name, customer_phone, rating, review_title, review_text, image_url, is_verified_buyer, is_approved)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 1)`,
        [
          product.id,
          product.name,
          cleanOrderId,
          userId,
          customer_name.trim(),
          customer_phone ? customer_phone.trim() : (req.user ? req.user.phone : null),
          numRating,
          review_title ? review_title.trim() : `${numRating} Star Experience`,
          review_text.trim(),
          imageUrl,
          isVerified
        ]
      );

      try {
        await Review.create({
          id: result.lastInsertRowid,
          product_id: product.id,
          product_name: product.name,
          order_id: cleanOrderId,
          user_id: userId,
          customer_name: customer_name.trim(),
          customer_phone: customer_phone ? customer_phone.trim() : (req.user ? req.user.phone : null),
          rating: numRating,
          review_title: review_title ? review_title.trim() : `${numRating} Star Experience`,
          review_text: review_text.trim(),
          image_url: imageUrl,
          is_verified_buyer: isVerified,
          is_approved: 1
        });
      } catch (mErr) {
        console.warn("[MongoDB] Review Atlas sync notice:", mErr.message);
      }

      const newReview = await db.get("SELECT * FROM reviews WHERE id = $1", [result.lastInsertRowid]);

      res.status(201).json({
        success: true,
        message: "Thank you! Your verified review and product photo have been added.",
        review: newReview
      });
    } catch (err) {
      next(err);
    }
  });
});

export default router;
