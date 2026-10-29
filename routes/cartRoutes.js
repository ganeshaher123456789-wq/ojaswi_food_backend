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

async function getCartFromSqlite(filter) {
  try {
    let row = null;
    if (filter.user_id) {
      row = await db.get("SELECT * FROM carts WHERE user_id = $1", [filter.user_id]);
    } else if (filter.session_id) {
      row = await db.get("SELECT * FROM carts WHERE session_id = $1", [filter.session_id]);
    }
    if (row && row.items_json) {
      const items = JSON.parse(row.items_json);
      return {
        items,
        subtotal: row.subtotal || 0,
        total_items: row.total_items || 0
      };
    }
  } catch (_) { }
  return null;
}

async function saveCartToSqlite(filter, cartData) {
  try {
    const itemsJson = JSON.stringify(cartData.items || []);
    const subtotal = Number(cartData.subtotal) || 0;
    const totalItems = Number(cartData.total_items) || 0;
    if (filter.user_id) {
      await db.run(
        `INSERT INTO carts (user_id, session_id, items_json, subtotal, total_items, updated_at)
         VALUES ($1, NULL, $2, $3, $4, datetime('now'))
         ON CONFLICT(user_id) DO UPDATE SET
           items_json = excluded.items_json,
           subtotal = excluded.subtotal,
           total_items = excluded.total_items,
           updated_at = datetime('now')`,
        [filter.user_id, itemsJson, subtotal, totalItems]
      );
    } else if (filter.session_id) {
      await db.run(
        `INSERT INTO carts (user_id, session_id, items_json, subtotal, total_items, updated_at)
         VALUES (NULL, $1, $2, $3, $4, datetime('now'))
         ON CONFLICT(session_id) DO UPDATE SET
           items_json = excluded.items_json,
           subtotal = excluded.subtotal,
           total_items = excluded.total_items,
           updated_at = datetime('now')`,
        [filter.session_id, itemsJson, subtotal, totalItems]
      );
    }
  } catch (_) { }
}

/**
 * GET /api/cart
 * Retrieve current customer's or guest's cart from MongoDB Atlas / SQLite
 */
router.get("/", async (req, res, next) => {
  try {
    const filter = getCartIdentifier(req);
    let cart = null;
    try {
      if (Cart) {
        cart = await Cart.findOne(filter).lean();
      }
    } catch (_) { }

    if (!cart) {
      cart = await getCartFromSqlite(filter);
    }

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
 * Add or increment item in cart
 */
router.post("/", async (req, res, next) => {
  try {
    const { productId, quantity = 1 } = req.body;
    const prodId = parseInt(productId, 10);
    const qty = Math.max(1, Math.min(50, parseInt(quantity, 10) || 1));

    if (!prodId || isNaN(prodId)) {
      return res.status(400).json({ success: false, error: "Valid productId is required." });
    }

    // Validate product existence and live stock
    let product = null;
    try {
      if (Product) {
        product = await Product.findOne({ id: prodId, is_active: 1 }).lean();
      }
    } catch (_) { }

    if (!product) {
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
    let cart = null;
    try {
      if (Cart) {
        cart = await Cart.findOne(filter);
      }
    } catch (_) { }

    if (!cart) {
      const sqliteCart = await getCartFromSqlite(filter);
      cart = {
        ...filter,
        items: sqliteCart ? sqliteCart.items : [],
        subtotal: sqliteCart ? sqliteCart.subtotal : 0,
        total_items: sqliteCart ? sqliteCart.total_items : 0,
        save: async function () {
          try {
            if (Cart) {
              await Cart.findOneAndUpdate(
                filter,
                { $set: { items: this.items, subtotal: this.subtotal, total_items: this.total_items } },
                { upsert: true, new: true }
              );
            }
          } catch (_) { }
        }
      };
    }

    const existingIndex = cart.items.findIndex((it) => (it.product_id || it.id) === prodId);
    const sellingPrice = product.selling_price || product.price;

    if (existingIndex > -1) {
      cart.items[existingIndex].quantity += qty;
    } else {
      cart.items.push({
        product_id: prodId,
        id: prodId,
        product_name: product.name,
        name: product.name,
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
    cart.subtotal = cart.items.reduce((acc, it) => acc + (it.selling_price || it.price) * (it.quantity || 1), 0);

    if (typeof cart.save === "function") {
      await cart.save();
    }
    await saveCartToSqlite(filter, cart);

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
 * Update quantity of a product in cart
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
    let cart = null;
    try {
      if (Cart) {
        cart = await Cart.findOne(filter);
      }
    } catch (_) { }

    if (!cart) {
      const sqliteCart = await getCartFromSqlite(filter);
      if (sqliteCart) {
        cart = {
          ...filter,
          items: sqliteCart.items,
          subtotal: sqliteCart.subtotal,
          total_items: sqliteCart.total_items,
          save: async function () {
            try {
              if (Cart) {
                await Cart.findOneAndUpdate(
                  filter,
                  { $set: { items: this.items, subtotal: this.subtotal, total_items: this.total_items } },
                  { upsert: true, new: true }
                );
              }
            } catch (_) { }
          }
        };
      }
    }

    if (!cart) {
      return res.status(404).json({ success: false, error: "Cart not found." });
    }

    if (qty <= 0) {
      cart.items = cart.items.filter((it) => (it.product_id || it.id) !== prodId);
    } else {
      const item = cart.items.find((it) => (it.product_id || it.id) === prodId);
      if (item) {
        item.quantity = Math.min(qty, 50);
      }
    }

    cart.total_items = cart.items.reduce((acc, it) => acc + (it.quantity || 1), 0);
    cart.subtotal = cart.items.reduce((acc, it) => acc + (it.selling_price || it.price) * (it.quantity || 1), 0);

    if (typeof cart.save === "function") {
      await cart.save();
    }
    await saveCartToSqlite(filter, cart);

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
 * Remove item from cart
 */
router.delete("/:productId", async (req, res, next) => {
  try {
    const prodId = parseInt(req.params.productId, 10);
    const filter = getCartIdentifier(req);
    let cart = null;
    try {
      if (Cart) {
        cart = await Cart.findOne(filter);
      }
    } catch (_) { }

    if (!cart) {
      const sqliteCart = await getCartFromSqlite(filter);
      if (sqliteCart) {
        cart = {
          ...filter,
          items: sqliteCart.items,
          subtotal: sqliteCart.subtotal,
          total_items: sqliteCart.total_items,
          save: async function () {
            try {
              if (Cart) {
                await Cart.findOneAndUpdate(
                  filter,
                  { $set: { items: this.items, subtotal: this.subtotal, total_items: this.total_items } },
                  { upsert: true, new: true }
                );
              }
            } catch (_) { }
          }
        };
      }
    }

    if (cart) {
      cart.items = cart.items.filter((it) => (it.product_id || it.id) !== prodId);
      cart.total_items = cart.items.reduce((acc, it) => acc + (it.quantity || 1), 0);
      cart.subtotal = cart.items.reduce((acc, it) => acc + (it.selling_price || it.price) * (it.quantity || 1), 0);
      if (typeof cart.save === "function") {
        await cart.save();
      }
      await saveCartToSqlite(filter, cart);
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
 * Empty cart
 */
router.delete("/", async (req, res, next) => {
  try {
    const filter = getCartIdentifier(req);
    let cart = null;
    try {
      if (Cart) {
        cart = await Cart.findOne(filter);
      }
    } catch (_) { }

    if (cart) {
      cart.items = [];
      cart.subtotal = 0;
      cart.total_items = 0;
      await cart.save();
    }
    await saveCartToSqlite(filter, { items: [], subtotal: 0, total_items: 0 });

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
 * Sync items with cart
 */
router.post("/sync", async (req, res, next) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.json({ success: true, message: "No items to sync." });
    }

    const filter = getCartIdentifier(req);
    const syncedItems = [];
    for (const it of items) {
      const prodId = parseInt(it.id || it.productId || it.product_id, 10);
      const qty = Math.max(1, Math.min(50, parseInt(it.quantity, 10) || 1));
      if (!prodId) continue;

      let prod = null;
      try {
        if (Product) {
          prod = await Product.findOne({ id: prodId, is_active: 1 }).lean();
        }
      } catch (_) { }
      if (!prod) {
        prod = await db.get("SELECT * FROM products WHERE id = $1 AND is_active = 1", [prodId]);
      }

      if (prod) {
        syncedItems.push({
          product_id: prodId,
          id: prodId,
          product_name: prod.name,
          name: prod.name,
          selling_price: prod.selling_price || prod.price,
          price: prod.price,
          weight: prod.weight || "NET WEIGHT 500g",
          image: prod.image,
          sku: prod.sku || `OJ-${prodId}`,
          quantity: qty
        });
      }
    }

    const total_items = syncedItems.reduce((acc, it) => acc + (it.quantity || 1), 0);
    const subtotal = syncedItems.reduce((acc, it) => acc + (it.selling_price || it.price) * (it.quantity || 1), 0);

    const cartData = { items: syncedItems, total_items, subtotal };

    try {
      if (Cart) {
        await Cart.findOneAndUpdate(filter, { $set: cartData }, { upsert: true, new: true });
      }
    } catch (_) { }

    await saveCartToSqlite(filter, cartData);

    res.json({
      success: true,
      message: "Cart items synced.",
      cart: cartData,
      items: syncedItems,
      subtotal,
      total_items
    });
  } catch (err) {
    next(err);
  }
});

export default router;
