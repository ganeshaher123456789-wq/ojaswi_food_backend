import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { db } from "../config/db.js";
import { requireAdmin } from "../middleware/auth.js";
import { OJASWI_CONSTANTS } from "../config/constants.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure Multer for product image uploads
const uploadDir = path.resolve(__dirname, "../images");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
    cb(null, `${cleanName}_${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
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

// Protect ALL admin routes with requireAdmin
router.use(requireAdmin);

/**
 * 1. GET /api/admin/dashboard
 * Aggregates KPIs
 */
router.get("/dashboard", async (req, res, next) => {
  try {
    const totalOrdersRow = await db.get("SELECT COUNT(*) as count FROM orders");
    const pendingOrdersRow = await db.get(
      "SELECT COUNT(*) as count FROM orders WHERE order_status IN ('Pending', 'Order Placed')"
    );
    const todayOrdersRow = await db.get(
      "SELECT COUNT(*) as count FROM orders WHERE date(created_at) = date('now')"
    );
    const revenueRow = await db.get(
      "SELECT SUM(total_amount) as total FROM orders WHERE order_status != 'Cancelled'"
    );
    const codOrdersRow = await db.get(
      "SELECT COUNT(*) as count FROM orders WHERE payment_method = 'Cash on Delivery'"
    );
    const onlineOrdersRow = await db.get(
      "SELECT COUNT(*) as count FROM orders WHERE payment_method = 'Online Payment'"
    );
    const customersRow = await db.get(
      "SELECT COUNT(*) as count FROM users WHERE role = 'customer'"
    );
    const productsRow = await db.get(
      "SELECT COUNT(*) as count FROM products WHERE is_active = 1"
    );

    res.json({
      success: true,
      stats: {
        totalOrders: totalOrdersRow?.count || 0,
        pendingOrders: pendingOrdersRow?.count || 0,
        todayOrders: todayOrdersRow?.count || 0,
        totalRevenue: Math.round(revenueRow?.total || 0),
        codOrders: codOrdersRow?.count || 0,
        onlineOrders: onlineOrdersRow?.count || 0,
        totalCustomers: customersRow?.count || 0,
        totalProducts: productsRow?.count || 0
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 2. GET /api/admin/orders
 * Returns all orders with items and delivery address
 */
router.get("/orders", async (req, res, next) => {
  try {
    const { status } = req.query;
    let query = "SELECT * FROM orders ORDER BY created_at DESC";
    let params = [];

    if (status && status !== "all") {
      query = "SELECT * FROM orders WHERE order_status = $1 ORDER BY created_at DESC";
      params = [status];
    }

    const orders = await db.all(query, params);

    const fullOrders = await Promise.all(
      orders.map(async (o) => {
        const items = await db.all("SELECT * FROM order_items WHERE order_id = $1", [o.id]);
        let address = {};
        try {
          address = JSON.parse(o.delivery_address_json);
        } catch {
          address = {};
        }
        return {
          ...o,
          delivery_address: address,
          items
        };
      })
    );

    res.json({
      success: true,
      orders: fullOrders
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 3. PUT /api/admin/orders/:id/status
 * Updates order lifecycle status
 */
router.put("/orders/:id/status", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, tracking_note, delivery_spot } = req.body;
    const rawId = decodeURIComponent(id).trim();
    const withHash = rawId.startsWith("#") ? rawId : `#${rawId}`;
    const withoutHash = rawId.startsWith("#") ? rawId.slice(1) : rawId;

    if (!OJASWI_CONSTANTS.ORDER_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Allowed values: ${OJASWI_CONSTANTS.ORDER_STATUSES.join(", ")}`
      });
    }

    let order = await db.get(
      "SELECT * FROM orders WHERE id = $1 OR id = $2 OR id = $3",
      [rawId, withHash, withoutHash]
    );

    if (!order) {
      order = await db.get("SELECT * FROM orders WHERE id LIKE $1 LIMIT 1", [`%${withoutHash}%`]);
    }

    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found." });
    }

    const orderId = order.id;
    let dispatchedAt = order.dispatched_at;
    let deliveredAt = order.delivered_at;

    if (status === "Shipped" && !dispatchedAt) {
      dispatchedAt = new Date().toISOString();
    }
    if (status === "Delivered" && !deliveredAt) {
      deliveredAt = new Date().toISOString();
    }

    const finalTrackingNote = tracking_note !== undefined ? tracking_note : order.tracking_note;
    const finalDeliverySpot = delivery_spot !== undefined ? delivery_spot : order.delivery_spot;

    await db.run(
      `UPDATE orders 
       SET order_status = $1, tracking_note = $2, delivery_spot = $3, dispatched_at = $4, delivered_at = $5, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $6`,
      [status, finalTrackingNote, finalDeliverySpot, dispatchedAt, deliveredAt, orderId]
    );

    // If marked delivered and was COD, mark payment_status as Paid
    if (status === "Delivered" && order.payment_method === OJASWI_CONSTANTS.PAYMENT_METHODS.COD) {
      await db.run("UPDATE orders SET payment_status = 'Paid' WHERE id = $1", [orderId]);
    }

    res.json({
      success: true,
      message: `Order ${orderId} status updated to ${status}.`,
      orderId,
      status,
      tracking_note: finalTrackingNote,
      delivery_spot: finalDeliverySpot
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 4. GET /api/admin/products
 * Returns all products (including inactive)
 */
router.get("/products", async (req, res, next) => {
  try {
    const products = await db.all("SELECT * FROM products ORDER BY id ASC");
    res.json({
      success: true,
      products
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 5. POST /api/admin/products
 * Create a new product
 */
router.post("/products", async (req, res, next) => {
  try {
    const {
      name,
      slug,
      sku,
      category,
      description,
      price,
      mrp,
      selling_price,
      weight,
      image,
      stock
    } = req.body;

    if (!name || !price || !image) {
      return res.status(400).json({
        success: false,
        error: "Product Name, Price, and Image are required."
      });
    }

    const cleanSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const cleanSku = sku || `OJ-${Date.now().toString().slice(-4)}`;

    const result = await db.run(
      `INSERT INTO products (name, slug, sku, category, description, price, mrp, selling_price, weight, image, stock, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 1)`,
      [
        name.trim(),
        cleanSlug,
        cleanSku,
        category || "Authentic Spices",
        description || "",
        parseFloat(price),
        mrp ? parseFloat(mrp) : parseFloat(price),
        selling_price ? parseFloat(selling_price) : parseFloat(price),
        weight || "NET WEIGHT 500g",
        image.trim(),
        parseInt(stock, 10) || 50
      ]
    );

    res.json({
      success: true,
      message: "Product created successfully.",
      productId: result.lastInsertRowid
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 6. PUT /api/admin/products/:id
 * Updates product details (price, stock, active status, etc.)
 */
router.put("/products/:id", async (req, res, next) => {
  try {
    const productId = parseInt(req.params.id, 10);
    const {
      name,
      description,
      price,
      mrp,
      selling_price,
      weight,
      stock,
      is_active,
      image
    } = req.body;

    const existing = await db.get("SELECT * FROM products WHERE id = $1", [productId]);
    if (!existing) {
      return res.status(404).json({ success: false, error: "Product not found." });
    }

    await db.run(
      `UPDATE products 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           price = COALESCE($3, price),
           mrp = COALESCE($4, mrp),
           selling_price = COALESCE($5, selling_price),
           weight = COALESCE($6, weight),
           stock = COALESCE($7, stock),
           is_active = COALESCE($8, is_active),
           image = COALESCE($9, image),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $10`,
      [
        name ? name.trim() : null,
        description !== undefined ? description : null,
        price !== undefined ? parseFloat(price) : null,
        mrp !== undefined ? parseFloat(mrp) : null,
        selling_price !== undefined ? parseFloat(selling_price) : null,
        weight || null,
        stock !== undefined ? parseInt(stock, 10) : null,
        is_active !== undefined ? parseInt(is_active, 10) : null,
        image || null,
        productId
      ]
    );

    res.json({
      success: true,
      message: "Product updated successfully."
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 7. DELETE /api/admin/products/:id
 * Toggles product active/deactive status
 */
router.delete("/products/:id", async (req, res, next) => {
  try {
    const productId = parseInt(req.params.id, 10);
    const product = await db.get("SELECT is_active FROM products WHERE id = $1", [productId]);
    if (!product) {
      return res.status(404).json({ success: false, error: "Product not found." });
    }

    const newStatus = product.is_active === 1 ? 0 : 1;
    await db.run("UPDATE products SET is_active = $1 WHERE id = $2", [newStatus, productId]);

    res.json({
      success: true,
      message: `Product ${newStatus === 1 ? "activated" : "deactivated"} successfully.`,
      isActive: newStatus
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 8. POST /api/admin/products/upload-image
 * Upload image for a product
 */
router.post("/products/upload-image", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: "No image file provided." });
  }

  const relativePath = `images/${req.file.filename}`;
  res.json({
    success: true,
    message: "Image uploaded successfully.",
    filePath: relativePath
  });
});

/**
 * 9. GET /api/admin/customers
 * Returns customer list with order counts
 */
router.get("/customers", async (req, res, next) => {
  try {
    const customers = await db.all(`
      SELECT u.id, u.name, u.phone, u.email, u.created_at,
             COUNT(o.id) as total_orders,
             COALESCE(SUM(o.total_amount), 0) as total_spent
      FROM users u
      LEFT JOIN orders o ON o.user_id = u.id OR o.customer_phone = u.phone
      WHERE u.role = 'customer'
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);

    res.json({
      success: true,
      customers
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 10. GET /api/admin/reviews
 * Returns all reviews with product information
 */
router.get("/reviews", async (req, res, next) => {
  try {
    const reviews = await db.all(`
      SELECT r.*, p.name as product_name, p.image as product_image
      FROM reviews r
      LEFT JOIN products p ON r.product_id = p.id
      ORDER BY r.created_at DESC
    `);

    res.json({
      success: true,
      reviews
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 11. DELETE /api/admin/reviews/:id
 * Delete a review
 */
router.delete("/reviews/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.run("DELETE FROM reviews WHERE id = $1", [id]);
    res.json({ success: true, message: "Review deleted successfully." });
  } catch (err) {
    next(err);
  }
});

/**
 * 12. PUT /api/admin/reviews/:id/toggle
 * Toggle review approval
 */
router.put("/reviews/:id/toggle", async (req, res, next) => {
  try {
    const { id } = req.params;
    const review = await db.get("SELECT id, is_approved FROM reviews WHERE id = $1", [id]);
    if (!review) return res.status(404).json({ success: false, error: "Review not found." });

    const newStatus = review.is_approved === 1 ? 0 : 1;
    await db.run("UPDATE reviews SET is_approved = $1 WHERE id = $2", [newStatus, id]);
    res.json({
      success: true,
      is_approved: newStatus,
      message: `Review ${newStatus ? 'approved' : 'hidden'}.`
    });
  } catch (err) {
    next(err);
  }
});

export default router;
