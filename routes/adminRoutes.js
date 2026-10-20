import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { db } from "../config/db.js";
import { Order, Product, User } from "../models/index.js";
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
 * Aggregates KPIs directly from MongoDB Atlas with SQLite fallback
 */
router.get("/dashboard", async (req, res, next) => {
  try {
    let totalOrders = 0;
    let pendingOrders = 0;
    let todayOrders = 0;
    let totalRevenue = 0;
    let codOrders = 0;
    let onlineOrders = 0;
    let totalCustomers = 0;
    let totalProducts = 0;
    let recentOrders = [];

    try {
      totalOrders = await Order.countDocuments({});
      pendingOrders = await Order.countDocuments({
        order_status: { $in: ["Pending", "Order Placed"] }
      });
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      todayOrders = await Order.countDocuments({ created_at: { $gte: startOfToday } });

      const revAgg = await Order.aggregate([
        { $match: { order_status: { $ne: "Cancelled" } } },
        { $group: { _id: null, total: { $sum: "$total_amount" } } }
      ]);
      totalRevenue = revAgg[0]?.total || 0;

      codOrders = await Order.countDocuments({
        payment_method: OJASWI_CONSTANTS.PAYMENT_METHODS.COD
      });
      onlineOrders = await Order.countDocuments({
        payment_method: { $ne: OJASWI_CONSTANTS.PAYMENT_METHODS.COD }
      });

      totalCustomers = await User.countDocuments({
        $or: [{ role: "customer" }, { role: { $exists: false } }]
      });
      totalProducts = await Product.countDocuments({ is_active: 1 });

      recentOrders = await Order.find({})
        .sort({ created_at: -1 })
        .limit(10)
        .lean();
    } catch (mErr) {
      console.warn("[ADMIN DASHBOARD] Mongo aggregation notice:", mErr.message);
    }

    // Fallback if collections are empty in Mongo
    if (totalOrders === 0) {
      const row = await db.get("SELECT COUNT(*) as count FROM orders");
      totalOrders = row?.count || 0;
      const pRow = await db.get("SELECT COUNT(*) as count FROM orders WHERE order_status IN ('Pending', 'Order Placed')");
      pendingOrders = pRow?.count || 0;
      const revRow = await db.get("SELECT SUM(total_amount) as total FROM orders WHERE order_status != 'Cancelled'");
      totalRevenue = revRow?.total || 0;
    }
    if (totalCustomers === 0) {
      const cRow = await db.get("SELECT COUNT(*) as count FROM users WHERE role = 'customer'");
      totalCustomers = cRow?.count || 0;
    }
    if (totalProducts === 0) {
      const pRow = await db.get("SELECT COUNT(*) as count FROM products WHERE is_active = 1");
      totalProducts = pRow?.count || 0;
    }

    res.json({
      success: true,
      stats: {
        totalOrders,
        pendingOrders,
        todayOrders,
        totalRevenue: Math.round(totalRevenue),
        codOrders,
        onlineOrders,
        totalCustomers,
        totalProducts
      },
      recentOrders
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 2. GET /api/admin/orders
 * Returns all orders with items and delivery address from MongoDB Atlas, supporting search and status filter
 */
router.get("/orders", async (req, res, next) => {
  try {
    const { status, search } = req.query;
    let mFilter = {};

    if (status && status !== "all") {
      mFilter.order_status = status;
    }

    if (search && search.trim()) {
      const q = search.trim();
      mFilter.$or = [
        { id: new RegExp(q, "i") },
        { customer_name: new RegExp(q, "i") },
        { customer_phone: new RegExp(q, "i") },
        { customer_email: new RegExp(q, "i") }
      ];
    }

    let orders = [];
    try {
      orders = await Order.find(mFilter).sort({ created_at: -1 }).limit(150).lean();
    } catch (mErr) {
      console.warn("[ADMIN ORDERS] Atlas query notice:", mErr.message);
    }

    if (!orders || orders.length === 0) {
      let query = "SELECT * FROM orders ORDER BY created_at DESC LIMIT 100";
      let params = [];
      if (status && status !== "all") {
        query = "SELECT * FROM orders WHERE order_status = $1 ORDER BY created_at DESC LIMIT 100";
        params = [status];
      }
      orders = await db.all(query, params);
      orders = await Promise.all(
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
    } else {
      orders = orders.map((o) => {
        let address = o.delivery_address || {};
        if ((!address || Object.keys(address).length === 0) && o.delivery_address_json) {
          try {
            address = JSON.parse(o.delivery_address_json);
          } catch (_) {}
        }
        return {
          ...o,
          delivery_address: address,
          items: o.items || []
        };
      });
    }

    res.json({
      success: true,
      orders
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 2b. GET /api/admin/orders/:id
 * Retrieve complete details of a single order for admin inspection
 */
router.get("/orders/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const rawId = decodeURIComponent(id).trim();
    const withHash = rawId.startsWith("#") ? rawId : `#${rawId}`;
    const withoutHash = rawId.startsWith("#") ? rawId.slice(1) : rawId;

    let order = await Order.findOne({
      $or: [{ id: rawId }, { id: withHash }, { id: withoutHash }]
    }).lean();

    if (!order) {
      order = await db.get(
        "SELECT * FROM orders WHERE id = $1 OR id = $2 OR id = $3",
        [rawId, withHash, withoutHash]
      );
      if (order) {
        order.items = await db.all("SELECT * FROM order_items WHERE order_id = $1", [order.id]);
      }
    }

    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found." });
    }

    let address = order.delivery_address || {};
    if ((!address || Object.keys(address).length === 0) && order.delivery_address_json) {
      try {
        address = JSON.parse(order.delivery_address_json);
      } catch (_) {}
    }

    let items = order.items && order.items.length > 0 ? order.items : [];
    if (items.length === 0) {
      try {
        items = await db.all("SELECT * FROM order_items WHERE order_id = $1", [order.id]);
      } catch (_) {}
    }

    res.json({
      success: true,
      order: {
        ...order,
        delivery_address: address,
        items
      }
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

    try {
      await Order.findOneAndUpdate(
        { id: orderId },
        {
          order_status: status,
          tracking_note: finalTrackingNote,
          delivery_spot: finalDeliverySpot,
          dispatched_at: dispatchedAt ? new Date(dispatchedAt) : undefined,
          delivered_at: deliveredAt ? new Date(deliveredAt) : undefined,
          payment_status: (status === "Delivered" && order.payment_method === OJASWI_CONSTANTS.PAYMENT_METHODS.COD) ? "Paid" : undefined,
          updated_at: new Date()
        }
      );
    } catch (mErr) {
      console.warn("[MongoDB] Admin order status Atlas notice:", mErr.message);
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

    try {
      const updateDoc = {};
      if (name) updateDoc.name = name.trim();
      if (description !== undefined) updateDoc.description = description;
      if (price !== undefined) updateDoc.price = parseFloat(price);
      if (mrp !== undefined) updateDoc.mrp = parseFloat(mrp);
      if (selling_price !== undefined) updateDoc.selling_price = parseFloat(selling_price);
      if (weight) updateDoc.weight = weight;
      if (stock !== undefined) updateDoc.stock = parseInt(stock, 10);
      if (is_active !== undefined) updateDoc.is_active = parseInt(is_active, 10);
      if (image) updateDoc.image = image;
      updateDoc.updated_at = new Date();

      await Product.findOneAndUpdate({ id: productId }, updateDoc);
    } catch (mErr) {
      console.warn("[MongoDB] Admin product update notice:", mErr.message);
    }

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

    try {
      await Product.findOneAndUpdate({ id: productId }, { is_active: newStatus });
    } catch (_) {}

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
 * Returns customer list with order counts, spent, address, and registration info from MongoDB Atlas
 */
router.get("/customers", async (req, res, next) => {
  try {
    const { search } = req.query;
    let mFilter = { $or: [{ role: "customer" }, { role: { $exists: false } }] };

    if (search && search.trim()) {
      const q = search.trim();
      mFilter = {
        $and: [
          { $or: [{ role: "customer" }, { role: { $exists: false } }] },
          {
            $or: [
              { name: new RegExp(q, "i") },
              { phone: new RegExp(q, "i") },
              { email: new RegExp(q, "i") },
              { city: new RegExp(q, "i") }
            ]
          }
        ]
      };
    }

    let customers = [];
    try {
      customers = await User.find(mFilter).sort({ created_at: -1 }).limit(200).lean();
    } catch (mErr) {
      console.warn("[ADMIN CUSTOMERS] Atlas query notice:", mErr.message);
    }

    if (!customers || customers.length === 0) {
      customers = await db.all(`
        SELECT u.id, u.name, u.phone, u.email, u.created_at, u.updated_at,
               COUNT(o.id) as total_orders,
               COALESCE(SUM(o.total_amount), 0) as total_spent
        FROM users u
        LEFT JOIN orders o ON o.user_id = u.id OR o.customer_phone = u.phone
        WHERE u.role = 'customer'
        GROUP BY u.id
        ORDER BY u.created_at DESC
        LIMIT 100
      `);
    } else {
      customers = await Promise.all(
        customers.map(async (c) => {
          const userPhone = c.phone;
          const userEmail = c.email;
          const userId = c.id;

          let orderCount = c.total_orders;
          let spent = c.total_spent;
          if (orderCount === undefined || orderCount === null || orderCount === 0) {
            const orList = [{ user_id: userId }];
            if (userPhone) orList.push({ customer_phone: userPhone });
            if (userEmail) orList.push({ customer_email: userEmail });

            try {
              const stats = await Order.aggregate([
                { $match: { $or: orList } },
                {
                  $group: {
                    _id: null,
                    count: { $sum: 1 },
                    spent: { $sum: "$total_amount" }
                  }
                }
              ]);
              orderCount = stats[0]?.count || 0;
              spent = stats[0]?.spent || 0;
            } catch (_) {
              orderCount = 0;
              spent = 0;
            }
          }

          return {
            id: c.id,
            name: c.name,
            phone: c.phone,
            email: c.email,
            delivery_address: c.delivery_address || null,
            city: c.city || (c.delivery_address && c.delivery_address.city) || null,
            state: c.state || (c.delivery_address && c.delivery_address.state) || null,
            pincode: c.pincode || (c.delivery_address && c.delivery_address.pincode) || null,
            total_orders: orderCount,
            total_spent: spent,
            last_order_id: c.last_order_id || null,
            last_order_date: c.last_order_date || null,
            last_login: c.last_login || null,
            created_at: c.created_at,
            updated_at: c.updated_at
          };
        })
      );
    }

    res.json({
      success: true,
      customers
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 9b. GET /api/admin/customers/:id
 * Retrieve single customer profile and individual order history from MongoDB Atlas
 */
router.get("/customers/:id", async (req, res, next) => {
  try {
    const rawId = req.params.id;
    const numId = !isNaN(rawId) ? parseInt(rawId, 10) : null;
    const orCust = [];
    if (numId !== null) orCust.push({ id: numId });
    if (mongoose.Types.ObjectId.isValid(rawId)) orCust.push({ _id: rawId });
    orCust.push({ phone: rawId });

    let customer = null;
    try {
      customer = await User.findOne({ $or: orCust }).lean();
    } catch (_) {}

    if (!customer && numId !== null) {
      try {
        customer = await db.get("SELECT * FROM users WHERE id = $1", [numId]);
      } catch (_) {}
    }

    if (!customer) {
      return res.status(404).json({ success: false, error: "Customer not found." });
    }

    // Retrieve full order history for this specific customer
    const orQuery = [{ user_id: customer.id }];
    if (customer.phone) orQuery.push({ customer_phone: customer.phone });
    if (customer.email) orQuery.push({ customer_email: customer.email });

    let orders = [];
    try {
      orders = await Order.find({ $or: orQuery }).sort({ created_at: -1 }).lean();
    } catch (_) {}

    if (!orders || orders.length === 0) {
      orders = await db.all(
        "SELECT * FROM orders WHERE user_id = $1 OR customer_phone = $2 ORDER BY created_at DESC",
        [customer.id, customer.phone || ""]
      );
    }

    const fullOrders = await Promise.all(
      orders.map(async (o) => {
        let items = o.items && o.items.length > 0 ? o.items : [];
        if (items.length === 0) {
          try {
            items = await db.all("SELECT * FROM order_items WHERE order_id = $1", [o.id]);
          } catch (_) {}
        }
        let address = o.delivery_address || {};
        if ((!address || Object.keys(address).length === 0) && o.delivery_address_json) {
          try {
            address = JSON.parse(o.delivery_address_json);
          } catch (_) {}
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
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        delivery_address: customer.delivery_address,
        city: customer.city,
        state: customer.state,
        pincode: customer.pincode,
        created_at: customer.created_at,
        updated_at: customer.updated_at,
        last_login: customer.last_login
      },
      orders: fullOrders,
      totalOrders: fullOrders.length,
      totalSpent: fullOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0)
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
