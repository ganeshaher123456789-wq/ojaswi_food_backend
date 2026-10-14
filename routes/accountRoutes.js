import express from "express";
import { db } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";
import { validateIndianPhone, validateIndianPincode, validateEmail } from "../utils/helpers.js";

const router = express.Router();

/**
 * GET /api/account
 * Fetch profile information and saved addresses
 */
router.get("/", requireAuth, async (req, res, next) => {
  try {
    let user = null;

    if (req.user.role === "admin") {
      user = {
        id: req.user.id,
        phone: req.user.phone || "",
        email: req.user.email || "",
        name: req.user.full_name || req.user.username || "Store Admin",
        role: "admin",
        created_at: req.user.created_at || new Date().toISOString()
      };
    } else {
      user = await db.get(
        "SELECT id, phone, email, name, role, created_at FROM users WHERE id = $1",
        [req.user.id]
      );
    }

    if (!user) {
      user = {
        id: req.user.id,
        phone: req.user.phone || "",
        email: req.user.email || "",
        name: req.user.name || "Customer",
        role: req.user.role || "customer",
        created_at: new Date().toISOString()
      };
    }

    if (user && user.phone) {
      await db.run(
        "UPDATE orders SET user_id = $1 WHERE customer_phone = $2 AND (user_id IS NULL OR user_id = 0)",
        [req.user.id, user.phone]
      );
    }

    const addresses = await db.all(
      "SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, id DESC",
      [req.user.id]
    );

    const recentOrders = await db.all(
      "SELECT id, total_amount, payment_method, payment_status, order_status, created_at FROM orders WHERE user_id = $1 OR (customer_phone IS NOT NULL AND customer_phone = $2) ORDER BY created_at DESC LIMIT 10",
      [req.user.id, user.phone || ""]
    );

    res.json({
      success: true,
      profile: user,
      addresses: addresses || [],
      recentOrders: recentOrders || []
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/account
 * Update customer profile name, email, phone
 */
router.put("/", requireAuth, async (req, res, next) => {
  try {
    const { name, email, phone } = req.body;

    if (!name || name.trim().length < 2) {
      return res.status(400).json({ success: false, error: "Please enter a valid name." });
    }

    if (email && !validateEmail(email)) {
      return res.status(400).json({ success: false, error: "Please enter a valid email address." });
    }

    let cleanPhone = null;
    if (phone) {
      cleanPhone = validateIndianPhone(phone);
      if (!cleanPhone) {
        return res.status(400).json({ success: false, error: "Please enter a valid 10-digit phone number." });
      }
    }

    await db.run(
      "UPDATE users SET name = $1, email = $2, phone = COALESCE($3, phone), updated_at = CURRENT_TIMESTAMP WHERE id = $4",
      [name.trim(), email ? email.trim().toLowerCase() : null, cleanPhone, req.user.id]
    );

    const updatedUser = await db.get("SELECT id, phone, email, name, role FROM users WHERE id = $1", [
      req.user.id
    ]);

    res.json({
      success: true,
      message: "Profile updated successfully.",
      user: updatedUser
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/account/addresses
 * Add a new delivery address
 */
router.post("/addresses", requireAuth, async (req, res, next) => {
  try {
    const { full_name, phone, flat_house, area_street, city, district, state, pincode, is_default } = req.body;

    if (!full_name || !phone || !flat_house || !area_street || !city || !state || !pincode) {
      return res.status(400).json({
        success: false,
        error: "All address fields (Name, Phone, House, Street, City, State, PIN code) are required."
      });
    }

    const cleanPhone = validateIndianPhone(phone);
    if (!cleanPhone) {
      return res.status(400).json({ success: false, error: "Please enter a valid 10-digit contact phone number." });
    }

    if (!validateIndianPincode(pincode)) {
      return res.status(400).json({ success: false, error: "Please enter a valid 6-digit Indian PIN code." });
    }

    const defaultVal = is_default ? 1 : 0;
    if (defaultVal === 1) {
      await db.run("UPDATE addresses SET is_default = 0 WHERE user_id = $1", [req.user.id]);
    }

    const result = await db.run(
      `INSERT INTO addresses (user_id, full_name, phone, flat_house, area_street, city, district, state, pincode, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        req.user.id,
        full_name.trim(),
        cleanPhone,
        flat_house.trim(),
        area_street.trim(),
        city.trim(),
        district ? district.trim() : null,
        state.trim(),
        pincode.trim(),
        defaultVal
      ]
    );

    res.json({
      success: true,
      message: "Address saved successfully.",
      addressId: result.lastInsertRowid
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/account/addresses/:id
 * Update an existing delivery address
 */
router.put("/addresses/:id", requireAuth, async (req, res, next) => {
  try {
    const addressId = parseInt(req.params.id, 10);
    const { full_name, phone, flat_house, area_street, city, district, state, pincode, is_default } = req.body;

    if (!full_name || !phone || !flat_house || !area_street || !city || !state || !pincode) {
      return res.status(400).json({
        success: false,
        error: "All address fields (Name, Phone, House, Street, City, State, PIN code) are required."
      });
    }

    const cleanPhone = validateIndianPhone(phone);
    if (!cleanPhone) {
      return res.status(400).json({ success: false, error: "Please enter a valid 10-digit contact phone number." });
    }

    if (!validateIndianPincode(pincode)) {
      return res.status(400).json({ success: false, error: "Please enter a valid 6-digit Indian PIN code." });
    }

    const defaultVal = is_default ? 1 : 0;
    if (defaultVal === 1) {
      await db.run("UPDATE addresses SET is_default = 0 WHERE user_id = $1", [req.user.id]);
    }

    await db.run(
      `UPDATE addresses 
       SET full_name = $1, phone = $2, flat_house = $3, area_street = $4, city = $5, district = $6, state = $7, pincode = $8, is_default = $9
       WHERE id = $10 AND user_id = $11`,
      [
        full_name.trim(),
        cleanPhone,
        flat_house.trim(),
        area_street.trim(),
        city.trim(),
        district ? district.trim() : null,
        state.trim(),
        pincode.trim(),
        defaultVal,
        addressId,
        req.user.id
      ]
    );

    res.json({
      success: true,
      message: "Address updated successfully."
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/account/addresses/:id/default
 * Set address as default
 */
router.put("/addresses/:id/default", requireAuth, async (req, res, next) => {
  try {
    const addressId = parseInt(req.params.id, 10);
    await db.run("UPDATE addresses SET is_default = 0 WHERE user_id = $1", [req.user.id]);
    await db.run("UPDATE addresses SET is_default = 1 WHERE id = $1 AND user_id = $2", [addressId, req.user.id]);

    res.json({
      success: true,
      message: "Default address updated."
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/account/addresses/:id
 */
router.delete("/addresses/:id", requireAuth, async (req, res, next) => {
  try {
    const addressId = parseInt(req.params.id, 10);
    await db.run("DELETE FROM addresses WHERE id = $1 AND user_id = $2", [addressId, req.user.id]);

    res.json({
      success: true,
      message: "Address removed."
    });
  } catch (err) {
    next(err);
  }
});

export default router;
