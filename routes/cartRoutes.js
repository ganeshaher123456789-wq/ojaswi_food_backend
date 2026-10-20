import express from "express";
import { Cart, Product } from "../models/index.js";
import { db } from "../config/db.js";

const router = express.Router();

/**
 * Helper to identify cart owner:
 * 1. Logged in customer: req.user.id
 * 2. Guest shopper: x-session-id header or safe guest identifier
 */
function getCartIdentifier(req) {
  if (req.user && req.user.id) {
    return { user_id: req.user.id };
  }
  const sessionId =
    req.headers["x-session-id"] ||
    req.headers["x-cart-id"] ||
    req.cookies?.ojaswi_cart_session ||
    "guest_session";
  return { session_id: sessionId };
}

/**
 * GET /api/cart
 * Retrieve current customer's or guest's cart from MongoDB Atlas
 */
router.get("/", async (req, res, next) => {
  try {
    const filter = getCartIdentifier(req);
    let cart = await Cart.findOne(filter).lean();

    if (!cart) {
      cart = {
        items: [],
        subtotal: 0,
        total_items: 0
      };
    }

    res.json({
      success: true,
      cart: {
        items: cart.items || [],
        subtotal: cart.subtotal || 0,
        total_items: cart.total_items || 0
      },
      items: cart.items || [],
      subtotal: cart.subtotal || 0,
      total_items: cart.total_items || 0
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/cart
 * Add or increment item in MongoDB Atlas cart
 */
router.post("/", async (req, res, next) => {
  try {
    const { productId, quantity = 1 } = req.body;
    const prodId = parseInt(productId, 10);
    const qty = Math.max(1, Math.min(50, parseInt(quantity, 10) || 1));

    if (!prodId || isNaN(prodId)) {
      return res.status(400).json({ success: false, error: "Valid productId is required." });
    }

    // Validate product existence and live stock from MongoDB Atlas
    let product = await Product.findOne({ id: prodId, is_active: 1 }).lean();
    if (!product) {
      // Fallback check in local db if needed
      product = await db.get("SELECT * FROM products WHERE id = $1 AND is_active = 1", [prodId]);
    }

    if (!product) {
      return res.status(404).json({ success: false, error: "Product not found or currently inactive." });
    }

    if (product.stock < qty) {
      return res.status(400).json({
        success: false,
        error: `Insufficient stock for ${product.name}. Available: ${product.stock}`
      });
    }

    const filter = getCartIdentifier(req);
    let cart = await Cart.findOne(filter);

    if (!cart) {
      cart = new Cart({
        ...filter,
        items: [],
        subtotal: 0,
        total_items: 0
      });
    }

    const existingIndex = cart.items.findIndex((it) => it.product_id === prodId);
    const sellingPrice = product.selling_price || product.price;

    if (existingIndex > -1) {
      cart.items[existingIndex].quantity += qty;
    } else {
      cart.items.push({
        product_id: prodId,
        product_name: product.name,
        selling_price: sellingPrice,
        price: product.price,
        weight: product.weight || "NET WEIGHT 500g",
        image: product.image,
        sku: product.sku || `OJ-${prodId}`,
        quantity: qty
      });
    }

    // Recalculate totals
    cart.total_items = cart.items.reduce((acc, it) => acc + (it.quantity || 1), 0);
    cart.subtotal = cart.items.reduce((acc, it) => acc + it.selling_price * (it.quantity || 1), 0);

    await cart.save();

    res.json({
      success: true,
      message: `Added ${product.name} to cart.`,
      cart: {
        items: cart.items,
        subtotal: cart.subtotal,
        total_items: cart.total_items
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/cart
 * Update quantity of a product in MongoDB Atlas cart
 */
router.put("/", async (req, res, next) => {
  try {
    const { productId, quantity } = req.body;
    const prodId = parseInt(productId, 10);
    const qty = parseInt(quantity, 10);

    if (!prodId || isNaN(prodId) || isNaN(qty)) {
      return res.status(400).json({ success: false, error: "Valid productId and quantity are required." });
    }

    const filter = getCartIdentifier(req);
    let cart = await Cart.findOne(filter);

    if (!cart) {
      return res.status(404).json({ success: false, error: "Cart not found." });
    }

    if (qty <= 0) {
      cart.items = cart.items.filter((it) => it.product_id !== prodId);
    } else {
      const item = cart.items.find((it) => it.product_id === prodId);
      if (item) {
        item.quantity = Math.min(qty, 50);
      }
    }

    cart.total_items = cart.items.reduce((acc, it) => acc + (it.quantity || 1), 0);
    cart.subtotal = cart.items.reduce((acc, it) => acc + it.selling_price * (it.quantity || 1), 0);

    await cart.save();

    res.json({
      success: true,
      cart: {
        items: cart.items,
        subtotal: cart.subtotal,
        total_items: cart.total_items
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/cart/:productId
 * Remove item from MongoDB Atlas cart
 */
router.delete("/:productId", async (req, res, next) => {
  try {
    const prodId = parseInt(req.params.productId, 10);
    const filter = getCartIdentifier(req);
    let cart = await Cart.findOne(filter);

    if (cart) {
      cart.items = cart.items.filter((it) => it.product_id !== prodId);
      cart.total_items = cart.items.reduce((acc, it) => acc + (it.quantity || 1), 0);
      cart.subtotal = cart.items.reduce((acc, it) => acc + it.selling_price * (it.quantity || 1), 0);
      await cart.save();
    }

    res.json({
      success: true,
      message: "Item removed from cart.",
      cart: cart || { items: [], subtotal: 0, total_items: 0 }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/cart
 * Empty cart in MongoDB Atlas
 */
router.delete("/", async (req, res, next) => {
  try {
    const filter = getCartIdentifier(req);
    let cart = await Cart.findOne(filter);

    if (cart) {
      cart.items = [];
      cart.subtotal = 0;
      cart.total_items = 0;
      await cart.save();
    }

    res.json({
      success: true,
      message: "Cart cleared.",
      cart: { items: [], subtotal: 0, total_items: 0 }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/cart/sync
 * Sync guest local items with MongoDB Atlas upon user login
 */
router.post("/sync", async (req, res, next) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.json({ success: true, message: "No items to sync." });
    }

    const filter = getCartIdentifier(req);
    let cart = await Cart.findOne(filter);
    if (!cart) {
      cart = new Cart({
        ...filter,
        items: [],
        subtotal: 0,
        total_items: 0
      });
    }

    const syncedItems = [];
    for (const it of items) {
      const prodId = parseInt(it.id || it.productId || it.product_id, 10);
      const qty = Math.max(1, Math.min(50, parseInt(it.quantity, 10) || 1));
      if (!prodId) continue;

      const prod = await Product.findOne({ id: prodId, is_active: 1 }).lean();
      if (prod) {
        syncedItems.push({
          product_id: prodId,
          product_name: prod.name,
          selling_price: prod.selling_price || prod.price,
          price: prod.price,
          weight: prod.weight || "NET WEIGHT 500g",
          image: prod.image,
          sku: prod.sku || `OJ-${prodId}`,
          quantity: qty
        });
      }
    }

    cart.items = syncedItems;
    cart.total_items = cart.items.reduce((acc, it) => acc + (it.quantity || 1), 0);
    cart.subtotal = cart.items.reduce((acc, it) => acc + it.selling_price * (it.quantity || 1), 0);

    await cart.save();

    res.json({
      success: true,
      message: "Cart items synced with MongoDB Atlas.",
      cart: {
        items: cart.items,
        subtotal: cart.subtotal,
        total_items: cart.total_items
      },
      items: cart.items,
      subtotal: cart.subtotal,
      total_items: cart.total_items
    });
  } catch (err) {
    next(err);
  }
});

export default router;
