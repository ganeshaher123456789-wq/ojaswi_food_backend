import express from "express";
import { db } from "../config/db.js";
import { User, Order, Product, Payment, Address } from "../models/index.js";
import { generateOrderId, validateIndianPhone, validateIndianPincode, validateEmail } from "../utils/helpers.js";
import { paymentService } from "../services/paymentService.js";
import { notificationService } from "../services/notificationService.js";
import { OJASWI_CONSTANTS } from "../config/constants.js";
import { requireAuth } from "../middleware/auth.js";
import { generateReceiptData, renderReceiptHtml } from "../utils/receiptGenerator.js";

const router = express.Router();

/**
 * POST /api/orders
 * Place a new order (Supports Guest with details OR Logged-in Customer)
 */
router.post("/", async (req, res, next) => {
  try {
    const {
      customer_name,
      customer_phone,
      customer_email,
      delivery_address,
      items,
      payment_method,
      notes
    } = req.body;

    // 1. Validate Customer Info
    if (!customer_name || typeof customer_name !== "string" || customer_name.trim().length < 2) {
      return res.status(400).json({ success: false, error: "Please enter your full name." });
    }

    const cleanPhone = validateIndianPhone(customer_phone);
    if (!cleanPhone) {
      return res.status(400).json({
        success: false,
        error: "Please enter a valid 10-digit Indian phone number."
      });
    }

    if (customer_email && !validateEmail(customer_email)) {
      return res.status(400).json({
        success: false,
        error: "Please enter a valid email address."
      });
    }

    // 2. Validate & Normalize Delivery Address
    let cleanAddress = null;
    if (typeof delivery_address === "string" && delivery_address.trim().length > 0) {
      const addrStr = delivery_address.trim();
      cleanAddress = {
        flat_house: addrStr,
        area_street: addrStr,
        city: "Malegaon",
        state: "Maharashtra",
        pincode: "423203"
      };
    } else if (delivery_address && typeof delivery_address === "object") {
      const rawStreet = delivery_address.area_street || delivery_address.address || delivery_address.street || "";
      const rawHouse = delivery_address.flat_house || rawStreet || "Premises";
      const rawCity = delivery_address.city || "Malegaon";
      const rawState = delivery_address.state || "Maharashtra";
      let rawPincode = delivery_address.pincode ? String(delivery_address.pincode).trim() : "";
      if (!validateIndianPincode(rawPincode)) {
        rawPincode = "423203";
      }

      cleanAddress = {
        flat_house: rawHouse,
        area_street: rawStreet || rawHouse,
        city: rawCity,
        state: rawState,
        pincode: rawPincode
      };
    }

    if (!cleanAddress || (!cleanAddress.flat_house && !cleanAddress.area_street)) {
      return res.status(400).json({ success: false, error: "Please provide a valid delivery address." });
    }

    // 3. Validate Cart Items from Database
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: "Your shopping cart is empty." });
    }

    const orderItems = [];
    let subtotal = 0;

    for (const item of items) {
      const product = await db.get("SELECT * FROM products WHERE id = $1 AND is_active = 1", [
        item.productId || item.id
      ]);

      if (!product) {
        return res.status(400).json({
          success: false,
          error: `Product with ID ${item.productId || item.id} is not available.`
        });
      }

      const qty = parseInt(item.quantity, 10) || 1;
      if (qty < 1 || qty > 100) {
        return res.status(400).json({
          success: false,
          error: `Invalid quantity for ${product.name}.`
        });
      }

      if (product.stock < qty) {
        return res.status(400).json({
          success: false,
          error: `Insufficient stock for ${product.name}. Available: ${product.stock}`
        });
      }

      const unitPrice = product.selling_price || product.price;
      const itemTotal = unitPrice * qty;
      subtotal += itemTotal;

      orderItems.push({
        product_id: product.id,
        product_name: product.name,
        product_image: product.image,
        product_location: product.location || OJASWI_CONSTANTS.LOCATION_FULL,
        sku: product.sku || `OJ-${product.id}`,
        unit_price: unitPrice,
        quantity: qty,
        total_price: itemTotal
      });
    }

    const deliveryCharge = OJASWI_CONSTANTS.DEFAULT_DELIVERY_CHARGE;
    const totalAmount = subtotal + deliveryCharge;

    // Idempotency check: prevent duplicate orders if client retries within 45 seconds
    try {
      const recentDuplicate = await Order.findOne({
        customer_phone: cleanPhone,
        total_amount: totalAmount,
        created_at: { $gte: new Date(Date.now() - 45 * 1000) }
      }).lean();

      if (recentDuplicate) {
        console.log(`[ORDER RETRY] Returning existing order ${recentDuplicate.id} for phone ${cleanPhone}`);
        return res.json({
          success: true,
          message: "Order placed successfully!",
          orderId: recentDuplicate.id,
          order: recentDuplicate,
          items: recentDuplicate.items && recentDuplicate.items.length > 0 ? recentDuplicate.items : orderItems,
          requiresOnlinePayment: false
        });
      }
    } catch (_) {}

    const orderId = generateOrderId();
    const isCOD = true;
    const paymentStatus = OJASWI_CONSTANTS.PAYMENT_STATUSES.COD_PENDING;
    const orderStatus = "Confirmed";

    // Associate order with verified authenticated customer ID, or auto-match registered customer by phone/email
    let userId = req.user ? req.user.id : null;
    if (!userId) {
      try {
        const matched = await User.findOne({
          $or: [
            ...(cleanPhone ? [{ phone: cleanPhone }] : []),
            ...(customer_email ? [{ email: customer_email.trim().toLowerCase() }] : [])
          ]
        }).lean();
        if (matched) {
          userId = matched.id;
        }
      } catch (_) {}
    }

    const addressJson = JSON.stringify(cleanAddress);

    // 4. Save Order in SQL Database
    await db.run(
      `INSERT INTO orders (id, user_id, customer_name, customer_phone, customer_email, subtotal, delivery_charge, discount_amount, total_amount, payment_method, payment_status, order_status, delivery_address_json, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8, $9, $10, $11, $12, $13)`,
      [
        orderId,
        userId,
        customer_name.trim(),
        cleanPhone,
        customer_email ? customer_email.trim().toLowerCase() : null,
        subtotal,
        deliveryCharge,
        totalAmount,
        isCOD ? OJASWI_CONSTANTS.PAYMENT_METHODS.COD : OJASWI_CONSTANTS.PAYMENT_METHODS.ONLINE,
        paymentStatus,
        orderStatus,
        addressJson,
        notes || null
      ]
    );

    // 5. Save Order Items & Reduce Stock (for COD immediately)
    for (const item of orderItems) {
      await db.run(
        `INSERT INTO order_items (order_id, product_id, product_name, product_image, product_location, sku, unit_price, quantity, total_price)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          orderId,
          item.product_id,
          item.product_name,
          item.product_image,
          item.product_location,
          item.sku,
          item.unit_price,
          item.quantity,
          item.total_price
        ]
      );

      if (isCOD) {
        await db.run(
          "UPDATE products SET stock = MAX(0, stock - $1) WHERE id = $2",
          [item.quantity, item.product_id]
        );
      }
    }

    // 5b. Persist Order and Items directly to MongoDB Atlas
    try {
      await Order.findOneAndUpdate(
        { id: orderId },
        {
          id: orderId,
          user_id: userId,
          customer_name: customer_name.trim(),
          customer_phone: cleanPhone,
          customer_email: customer_email ? customer_email.trim().toLowerCase() : null,
          subtotal,
          delivery_charge: deliveryCharge,
          discount_amount: 0,
          total_amount: totalAmount,
          payment_method: isCOD ? OJASWI_CONSTANTS.PAYMENT_METHODS.COD : OJASWI_CONSTANTS.PAYMENT_METHODS.ONLINE,
          payment_status: paymentStatus,
          order_status: orderStatus,
          delivery_address: cleanAddress,
          delivery_address_json: addressJson,
          items: orderItems,
          notes: notes || null,
          created_at: new Date(),
          updated_at: new Date()
        },
        { upsert: true, returnDocument: 'after' }
      );

      // Update customer stats and address in MongoDB Atlas
      if (userId) {
        try {
          await User.findOneAndUpdate(
            { id: userId },
            {
              $inc: { total_orders: 1, total_spent: totalAmount },
              $set: {
                last_order_id: orderId,
                last_order_date: new Date(),
                delivery_address: cleanAddress,
                city: cleanAddress.city || "Malegaon",
                state: cleanAddress.state || "Maharashtra",
                pincode: cleanAddress.pincode || "423203",
                updated_at: new Date()
              }
            }
          );
        } catch (uErr) {
          console.warn("[MongoDB] Customer order stats sync notice:", uErr.message);
        }

        // Record address in Address collection
        try {
          await Address.create({
            user_id: userId,
            recipient_name: customer_name.trim(),
            recipient_phone: cleanPhone,
            flat_house: cleanAddress.flat_house,
            area_street: cleanAddress.area_street,
            city: cleanAddress.city || "Malegaon",
            state: cleanAddress.state || "Maharashtra",
            pincode: cleanAddress.pincode || "423203",
            is_default: true,
            created_at: new Date()
          });
        } catch (_) {}
      }

      if (isCOD) {
        for (const item of orderItems) {
          await Product.findOneAndUpdate(
            { id: item.product_id },
            { $inc: { stock: -item.quantity } }
          );
        }
      }
    } catch (mErr) {
      console.warn("[MongoDB] Order Atlas sync notice:", mErr.message);
    }

    const createdOrder = await db.get("SELECT * FROM orders WHERE id = $1", [orderId]);
    createdOrder.delivery_address = cleanAddress;

    // 6. Handle COD vs Online Payment
    if (isCOD) {
      // Dispatches WhatsApp, SMS, and Email
      notificationService.notifyOrderPlaced(createdOrder, orderItems).catch(console.error);

      return res.json({
        success: true,
        message: "Order placed successfully!",
        orderId,
        order: createdOrder,
        items: orderItems,
        requiresOnlinePayment: false
      });
    }

    // Online Payment -> Initialize Razorpay Order
    const razorpayOrder = await paymentService.createOrder(totalAmount, orderId);

    // Save payment record in SQL & MongoDB Atlas
    await db.run(
      `INSERT INTO payments (order_id, payment_method, gateway, gateway_order_id, amount, status)
       VALUES ($1, 'Online Payment', 'Razorpay', $2, $3, 'Created')`,
      [orderId, razorpayOrder.id, totalAmount]
    );

    try {
      await Payment.create({
        order_id: orderId,
        payment_method: "Online Payment",
        gateway: "Razorpay",
        gateway_order_id: razorpayOrder.id,
        amount: totalAmount,
        status: "Created"
      });
    } catch (mErr) {
      console.warn("[MongoDB] Payment Atlas sync notice:", mErr.message);
    }

    res.json({
      success: true,
      message: "Order initiated. Please proceed to payment.",
      orderId,
      order: createdOrder,
      items: orderItems,
      requiresOnlinePayment: true,
      razorpayOrder
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/orders
 * Customer view: lists orders for current logged-in customer strictly isolated by authenticated user_id
 */
router.get("/", async (req, res, next) => {
  try {
    const { search, orderId } = req.query;

    // Authenticated customer: strictly access only their own orders by authenticated user_id
    if (!req.user || !req.user.id) {
      return res.json({
        success: true,
        orders: [],
        requiresAuth: true,
        message: "Please log in to view your order history."
      });
    }

    const customerId = req.user.id;
    let mFilter = { user_id: customerId };

    if (orderId && orderId.trim()) {
      const cleanId = orderId.trim();
      const withHash = cleanId.startsWith("#") ? cleanId : `#${cleanId}`;
      const withoutHash = cleanId.startsWith("#") ? cleanId.slice(1) : cleanId;
      mFilter = {
        user_id: customerId,
        $or: [{ id: cleanId }, { id: withHash }, { id: withoutHash }]
      };
    } else if (search && search.trim()) {
      const q = search.trim();
      mFilter = {
        user_id: customerId,
        $or: [
          { id: new RegExp(q, "i") },
          { customer_name: new RegExp(q, "i") }
        ]
      };
    }

    let orders = [];
    try {
      orders = await Order.find(mFilter).sort({ created_at: -1 }).limit(50).lean();
    } catch (mErr) {
      console.warn("[ORDERS] Atlas query fallback:", mErr.message);
    }

    if (!orders || orders.length === 0) {
      if (orderId && orderId.trim()) {
        const cleanId = orderId.trim().startsWith("#") ? orderId.trim() : `#${orderId.trim()}`;
        orders = await db.all(
          `SELECT * FROM orders WHERE user_id = $1 AND (id = $2 OR id = $3) ORDER BY created_at DESC LIMIT 10`,
          [customerId, cleanId, orderId.trim()]
        );
      } else if (search && search.trim()) {
        const q = search.trim();
        const cleanId = q.startsWith("#") ? q : `#${q}`;
        orders = await db.all(
          `SELECT * FROM orders 
           WHERE user_id = $1 AND (id LIKE $2 OR id = $3 OR customer_name LIKE $2) 
           ORDER BY created_at DESC LIMIT 50`,
          [customerId, `%${q}%`, cleanId]
        );
      } else {
        orders = await db.all(
          `SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
          [customerId]
        );
      }
    }

    const fullOrders = await Promise.all(
      orders.map(async (o) => {
        let items = o.items && o.items.length > 0 ? o.items : [];
        if (items.length === 0) {
          try {
            items = await db.all("SELECT * FROM order_items WHERE order_id = $1", [o.id]);
          } catch (_) {}
        }
        let addr = o.delivery_address || {};
        if ((!addr || Object.keys(addr).length === 0) && o.delivery_address_json) {
          try {
            addr = JSON.parse(o.delivery_address_json);
          } catch {
            addr = {};
          }
        }
        return {
          ...o,
          delivery_address: addr,
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
 * GET /api/orders/:id
 * Retrieve specific order status, live tracking timeline and receipt details
 */
router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const rawId = decodeURIComponent(id).trim();
    const withHash = rawId.startsWith("#") ? rawId : `#${rawId}`;
    const withoutHash = rawId.startsWith("#") ? rawId.slice(1) : rawId;

    // Search by exact ID, with hash, or without hash across SQLite and MongoDB Atlas
    let order = await db.get(
      "SELECT * FROM orders WHERE id = $1 OR id = $2 OR id = $3",
      [rawId, withHash, withoutHash]
    );

    if (!order) {
      try {
        order = await Order.findOne({
          $or: [{ id: rawId }, { id: withHash }, { id: withoutHash }]
        }).lean();
      } catch (_) {}
    }

    // Fallback: search by suffix or partial match
    if (!order) {
      order = await db.get(
        "SELECT * FROM orders WHERE id LIKE $1 LIMIT 1",
        [`%${withoutHash}%`]
      );
    }
    if (!order) {
      try {
        order = await Order.findOne({ id: new RegExp(withoutHash, "i") }).lean();
      } catch (_) {}
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        error: `Order with ID "${rawId}" was not found.`
      });
    }

    // Authorization check: Customer can only view their own orders; admin can view all
    if (order.user_id) {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: "Authentication required. Please log in to view this order."
        });
      }
      if (order.user_id !== req.user.id && req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          error: "Access denied. You can only view your own orders."
        });
      }
    }

    let items = order.items && order.items.length > 0 ? order.items : [];
    if (items.length === 0) {
      items = await db.all("SELECT * FROM order_items WHERE order_id = $1", [order.id]);
    }

    let address = order.delivery_address || {};
    if ((!address || Object.keys(address).length === 0) && order.delivery_address_json) {
      try {
        address = JSON.parse(order.delivery_address_json);
      } catch {
        address = {};
      }
    }

    // Mask sensitive customer PII for unauthenticated status tracking to prevent data leaks
    let customerPhone = order.customer_phone;
    let customerEmail = order.customer_email;
    let safeAddress = { ...address };

    if (!req.user && order.user_id) {
      if (customerPhone) {
        customerPhone = customerPhone.length >= 10 
          ? customerPhone.slice(0, 2) + "******" + customerPhone.slice(-2) 
          : "******";
      }
      if (customerEmail && customerEmail.includes("@")) {
        const parts = customerEmail.split("@");
        customerEmail = parts[0].slice(0, 2) + "***@" + parts[1];
      }
      if (safeAddress.flat_house) {
        safeAddress.flat_house = "***";
      }
    }

    // Build order lifecycle timeline with all 8 official statuses
    const statusMeta = {
      "Pending": { title: "Order Placed", desc: "Awaiting confirmation & processing", icon: "📝" },
      "Confirmed": { title: "Order Confirmed", desc: "Order received & verified at Malegaon unit", icon: "✓" },
      "Processing": { title: "Stone Grounding & Quality Check", desc: "Batch grinding with certified whole spices", icon: "🌿" },
      "Packed": { title: "Packed & Hermetically Sealed", desc: "Air-tight aroma lock packaging applied", icon: "📦" },
      "Shipped": { title: "Dispatched from Malegaon", desc: "Handed over to courier express partner in Malegaon", icon: "🚚" },
      "Out for Delivery": { title: "Reached Delivery Spot", desc: "Package reached local delivery spot & out for delivery", icon: "🛵" },
      "Delivered": { title: "Delivered & Received", desc: "Package safely delivered to recipient", icon: "🏠" },
      "Cancelled": { title: "Order Cancelled", desc: "Order was cancelled", icon: "❌" }
    };

    const currentStatus = order.order_status || "Confirmed";
    const currentIdx = OJASWI_CONSTANTS.ORDER_STATUSES.indexOf(currentStatus);

    const timeline = OJASWI_CONSTANTS.ORDER_STATUSES.map((statusKey, idx) => {
      const meta = statusMeta[statusKey] || { title: statusKey, desc: "", icon: "•" };
      const isCancelled = currentStatus === "Cancelled";
      return {
        status: statusKey,
        title: meta.title,
        description: meta.desc,
        icon: meta.icon,
        completed: isCancelled ? statusKey === "Cancelled" : (statusKey !== "Cancelled" && currentIdx !== -1 && idx <= currentIdx),
        current: statusKey === currentStatus,
        pending: isCancelled ? statusKey !== "Cancelled" : (statusKey === "Cancelled" || currentIdx === -1 || idx > currentIdx)
      };
    });

    // Estimated delivery calculation (3 days from created_at)
    const createdDate = new Date(order.created_at || Date.now());
    const estDeliveryDate = new Date(createdDate.getTime() + 3 * 24 * 60 * 60 * 1000);
    const estDeliveryStr = estDeliveryDate.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric"
    });

    const cleanTrackingCode = "OJ-" + order.id.replace(/\W/g, "").toUpperCase();
    const city = address.city || "Malegaon";
    const deliverySpot = order.delivery_spot || `${city} Delivery Hub`;
    let trackingNote = order.tracking_note;
    if (!trackingNote) {
      if (currentStatus === "Shipped") {
        trackingNote = "Package has been dispatched from Malegaon spice unit via Express Courier.";
      } else if (currentStatus === "Out for Delivery") {
        trackingNote = `Package has reached the delivery spot (${deliverySpot}) and is out for delivery.`;
      } else if (currentStatus === "Delivered") {
        trackingNote = "Package delivered safely to customer. Thank you for choosing Ojaswi!";
      } else {
        trackingNote = "Order is being prepared with pure whole spices at 52/2 Malegaon 423203.";
      }
    }

    res.json({
      success: true,
      order: {
        ...order,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        delivery_address: safeAddress,
        items,
        timeline,
        tracking: {
          current_stage: currentStatus,
          current_stage_title: statusMeta[currentStatus]?.title || currentStatus,
          estimated_delivery: estDeliveryStr,
          courier_partner: "India Post Speed Post / DTDC Express",
          awb_number: cleanTrackingCode,
          dispatch_location: OJASWI_CONSTANTS.PACKED_BY,
          delivery_spot: deliverySpot,
          tracking_note: trackingNote,
          dispatched_at: order.dispatched_at || null,
          delivered_at: order.delivered_at || null,
          is_dispatched: ["Shipped", "Out for Delivery", "Delivered"].includes(currentStatus),
          is_out_for_delivery: ["Out for Delivery", "Delivered"].includes(currentStatus),
          is_delivered: currentStatus === "Delivered",
          whatsapp_track_url: `https://wa.me/917620098478?text=${encodeURIComponent('Hello Ojaswi Foods, please provide a live tracking update for my order ' + order.id)}`
        },
        fssai: OJASWI_CONSTANTS.FSSAI_LICENSE,
        location: OJASWI_CONSTANTS.PACKED_BY
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/orders/:id/receipt
 * Generate official tax invoice receipt from actual order data
 */
router.get("/:id/receipt", async (req, res, next) => {
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
      return res.status(404).json({
        success: false,
        error: `Order with ID "${rawId}" was not found.`
      });
    }

    // Authorization check: Customer can only view their own receipts; admin can view all
    if (order.user_id) {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: "Authentication required. Please log in to view this receipt."
        });
      }
      if (order.user_id !== req.user.id && req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          error: "Access denied. You can only view your own order receipts."
        });
      }
    } else {
      if (req.user && req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          error: "Access denied. You can only view your own order receipts."
        });
      }
    }

    if (!order.items || order.items.length === 0) {
      order.items = await db.all("SELECT * FROM order_items WHERE order_id = $1", [order.id]);
    }

    const receipt = generateReceiptData(order);

    if (req.query.format === "html" || (req.headers.accept && req.headers.accept.includes("text/html"))) {
      return res.send(renderReceiptHtml(receipt));
    }

    res.json({
      success: true,
      receipt
    });
  } catch (err) {
    next(err);
  }
});

export default router;
