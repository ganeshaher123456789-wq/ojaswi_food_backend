import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { ENV } from "../config/env.js";
import { connectMongo } from "../config/mongodb.js";
import {
  User,
  Product,
  Category,
  Cart,
  Order,
  Payment,
  Address,
  Review,
  OtpRequest,
  ContactEnquiry,
  Notification
} from "../models/index.js";
import { INITIAL_PRODUCTS } from "../database/seed.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CATEGORY_METADATA = [
  {
    name: "Blended Masala",
    slug: "blended-masala",
    description: "Traditional roasted aromatic whole spice blends for rich authentic curries.",
    image: "images/garam-masala.jpeg"
  },
  {
    name: "Curry & Gravy Special",
    slug: "curry-gravy-special",
    description: "All-in-one royal masala for luscious restaurant-style vegetable and paneer gravies.",
    image: "images/kitchen-king.jpeg"
  },
  {
    name: "Everyday Sabji",
    slug: "everyday-sabji",
    description: "Everyday wholesome spice blend with appetizing golden color and balanced aroma.",
    image: "images/sabji-masala.jpeg"
  },
  {
    name: "Snack & Chaat Spices",
    slug: "snack-chaat-spices",
    description: "Zesty, tangy black salt and roasted cumin sprinkles for street foods and salads.",
    image: "images/chaat-masala.jpeg"
  },
  {
    name: "Royal Rice & Biryani",
    slug: "royal-rice-biryani",
    description: "Fragrant exotic spice blend infused with shahi jeera, star anise, mace and cardamom.",
    image: "images/biryani-masala.jpeg"
  },
  {
    name: "Speciality Masala",
    slug: "speciality-masala",
    description: "Authentic regional Maharashtrian specialties including Pav Bhaji, Misal, and Chhole masalas.",
    image: "images/misal-masala.jpeg"
  },
  {
    name: "Authentic Spices",
    slug: "authentic-spices",
    description: "Single-origin stone-ground spices processed at Malegaon 423203 facility.",
    image: "images/garam-masala.jpeg"
  }
];

export async function syncMongoAtlas() {
  const mongoStatus = await connectMongo();
  if (!mongoStatus.connected) {
    console.warn("[MongoSync] MongoDB Atlas is not connected. Skipping Atlas sync.");
    return { success: false, error: mongoStatus.message || mongoStatus.error };
  }

  console.log(`[MongoSync] Synchronizing collections with database "${mongoose.connection.name}" on MongoDB Atlas...`);

  // Open SQLite database to copy existing seed/production data if available
  const dbPath = path.resolve(__dirname, "../database/ojaswi.db");
  let sqlite = null;
  if (fs.existsSync(dbPath)) {
    try {
      sqlite = new DatabaseSync(dbPath);
    } catch (e) {
      console.warn("[MongoSync] Note on SQLite read:", e.message);
    }
  }

  // 1. Sync Products Collection
  const productCount = await Product.countDocuments();
  if (productCount === 0 || productCount < 11) {
    console.log("[MongoSync] Seeding Products to MongoDB Atlas...");
    for (let i = 0; i < INITIAL_PRODUCTS.length; i++) {
      const p = INITIAL_PRODUCTS[i];
      const prodId = i + 1;
      const imagesArr = p.images && p.images.length > 0 ? p.images : [p.image];
      await Product.findOneAndUpdate(
        { id: prodId },
        {
          id: prodId,
          name: p.name,
          slug: p.slug,
          product_number: p.product_number,
          sku: p.sku || `OJ-${p.slug.toUpperCase().slice(0, 4)}-${prodId}`,
          category: p.category || "Authentic Spices",
          location: p.location || "52/2, Malegaon - 423203, Nashik, Maharashtra, India",
          description: p.description,
          price: p.price,
          mrp: p.mrp || p.price + 50,
          selling_price: p.selling_price || p.price,
          weight: p.weight || "NET WEIGHT 500g",
          image: p.image,
          image_backup: p.image_backup || p.image,
          images: imagesArr,
          images_json: JSON.stringify(imagesArr),
          stock: p.stock || 100,
          is_active: p.is_active !== undefined ? p.is_active : 1
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
    console.log("[MongoSync] Products collection synchronized.");
  }

  // 2. Sync Categories Collection
  const categoryCount = await Category.countDocuments();
  if (categoryCount === 0) {
    console.log("[MongoSync] Seeding Categories to MongoDB Atlas...");
    for (let i = 0; i < CATEGORY_METADATA.length; i++) {
      const c = CATEGORY_METADATA[i];
      const count = await Product.countDocuments({ category: c.name, is_active: 1 });
      await Category.findOneAndUpdate(
        { slug: c.slug },
        {
          id: i + 1,
          name: c.name,
          slug: c.slug,
          description: c.description,
          image: c.image,
          product_count: count,
          is_active: 1
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
    console.log("[MongoSync] Categories collection synchronized.");
  }

  // 3. Sync Users Collection (Customers & Admins)
  const userCount = await User.countDocuments();
  if (userCount === 0 && sqlite) {
    console.log("[MongoSync] Migrating existing users from SQLite to MongoDB Atlas...");
    try {
      const existingUsers = sqlite.prepare("SELECT * FROM users").all();
      for (const u of existingUsers) {
        await User.findOneAndUpdate(
          { phone: u.phone },
          {
            id: u.id,
            phone: u.phone,
            email: u.email,
            name: u.name,
            password_hash: u.password_hash,
            role: u.role || "customer",
            created_at: u.created_at ? new Date(u.created_at) : new Date(),
            updated_at: u.updated_at ? new Date(u.updated_at) : new Date()
          },
          { upsert: true, new: true }
        );
      }
      console.log(`[MongoSync] Migrated ${existingUsers.length} users to MongoDB Atlas.`);
    } catch (e) {
      console.warn("[MongoSync] User migration notice:", e.message);
    }
  }

  // Always ensure default Administrator user exists in MongoDB Atlas
  const adminInMongo = await User.findOne({
    $or: [{ role: "admin" }, { email: ENV.ADMIN_DEFAULT_EMAIL }, { name: "Ojaswi Administrator" }]
  });
  if (!adminInMongo) {
    console.log(`[MongoSync] Creating default admin user (${ENV.ADMIN_DEFAULT_USER}) in MongoDB Atlas...`);
    const passwordHash = await bcrypt.hash(ENV.ADMIN_DEFAULT_PASSWORD, 10);
    await User.create({
      id: 9999,
      name: "Ojaswi Administrator",
      email: ENV.ADMIN_DEFAULT_EMAIL,
      phone: "917620098478",
      password_hash: passwordHash,
      role: "admin"
    });
    console.log("[MongoSync] Admin user created in MongoDB Atlas.");
  }

  // 4. Sync Addresses Collection
  const addressCount = await Address.countDocuments();
  if (addressCount === 0 && sqlite) {
    console.log("[MongoSync] Migrating saved customer addresses to MongoDB Atlas...");
    try {
      const existingAddresses = sqlite.prepare("SELECT * FROM addresses").all();
      for (const a of existingAddresses) {
        await Address.findOneAndUpdate(
          { id: a.id },
          {
            id: a.id,
            user_id: a.user_id,
            full_name: a.full_name,
            phone: a.phone,
            flat_house: a.flat_house,
            area_street: a.area_street,
            city: a.city,
            district: a.district,
            state: a.state,
            pincode: a.pincode,
            is_default: a.is_default || 0,
            created_at: a.created_at ? new Date(a.created_at) : new Date()
          },
          { upsert: true, new: true }
        );
      }
      console.log(`[MongoSync] Migrated ${existingAddresses.length} addresses to MongoDB Atlas.`);
    } catch (e) {
      console.warn("[MongoSync] Address migration notice:", e.message);
    }
  }

  // 5. Sync Orders & Order Items Collection
  const orderCount = await Order.countDocuments();
  if (orderCount === 0 && sqlite) {
    console.log("[MongoSync] Migrating customer orders and order items to MongoDB Atlas...");
    try {
      const existingOrders = sqlite.prepare("SELECT * FROM orders").all();
      const allOrderItems = sqlite.prepare("SELECT * FROM order_items").all();

      const itemsByOrderId = {};
      for (const it of allOrderItems) {
        if (!itemsByOrderId[it.order_id]) itemsByOrderId[it.order_id] = [];
        itemsByOrderId[it.order_id].push({
          product_id: it.product_id,
          product_name: it.product_name,
          product_image: it.product_image,
          product_location: it.product_location,
          sku: it.sku,
          unit_price: it.unit_price,
          quantity: it.quantity,
          total_price: it.total_price
        });
      }

      for (const o of existingOrders) {
        let addrObj = null;
        try {
          addrObj = JSON.parse(o.delivery_address_json);
        } catch {
          addrObj = { address: o.delivery_address_json };
        }

        await Order.findOneAndUpdate(
          { id: o.id },
          {
            id: o.id,
            user_id: o.user_id,
            customer_name: o.customer_name,
            customer_phone: o.customer_phone,
            customer_email: o.customer_email,
            subtotal: o.subtotal,
            delivery_charge: o.delivery_charge || 0,
            discount_amount: o.discount_amount || 0,
            total_amount: o.total_amount,
            payment_method: o.payment_method,
            payment_status: o.payment_status,
            order_status: o.order_status,
            delivery_address: addrObj,
            delivery_address_json: o.delivery_address_json,
            items: itemsByOrderId[o.id] || [],
            notes: o.notes,
            tracking_note: o.tracking_note,
            delivery_spot: o.delivery_spot,
            dispatched_at: o.dispatched_at ? new Date(o.dispatched_at) : null,
            delivered_at: o.delivered_at ? new Date(o.delivered_at) : null,
            created_at: o.created_at ? new Date(o.created_at) : new Date(),
            updated_at: o.updated_at ? new Date(o.updated_at) : new Date()
          },
          { upsert: true, new: true }
        );
      }
      console.log(`[MongoSync] Migrated ${existingOrders.length} customer orders to MongoDB Atlas.`);
    } catch (e) {
      console.warn("[MongoSync] Order migration notice:", e.message);
    }
  }

  // 6. Sync Payments Collection
  const paymentCount = await Payment.countDocuments();
  if (paymentCount === 0 && sqlite) {
    console.log("[MongoSync] Migrating payment transactions to MongoDB Atlas...");
    try {
      const existingPayments = sqlite.prepare("SELECT * FROM payments").all();
      for (const py of existingPayments) {
        await Payment.findOneAndUpdate(
          { order_id: py.order_id, gateway_order_id: py.gateway_order_id },
          {
            id: py.id,
            order_id: py.order_id,
            payment_method: py.payment_method,
            gateway: py.gateway || "Razorpay",
            gateway_order_id: py.gateway_order_id,
            gateway_payment_id: py.gateway_payment_id,
            gateway_signature: py.gateway_signature,
            amount: py.amount,
            currency: py.currency || "INR",
            status: py.status,
            created_at: py.created_at ? new Date(py.created_at) : new Date()
          },
          { upsert: true, new: true }
        );
      }
      console.log(`[MongoSync] Migrated ${existingPayments.length} payment records to MongoDB Atlas.`);
    } catch (e) {
      console.warn("[MongoSync] Payment migration notice:", e.message);
    }
  }

  // 7. Sync Reviews Collection
  const reviewCount = await Review.countDocuments();
  if (reviewCount === 0 && sqlite) {
    console.log("[MongoSync] Migrating verified product reviews to MongoDB Atlas...");
    try {
      const existingReviews = sqlite.prepare("SELECT * FROM reviews").all();
      for (const r of existingReviews) {
        await Review.findOneAndUpdate(
          { product_id: r.product_id, customer_name: r.customer_name },
          {
            id: r.id,
            product_id: r.product_id,
            product_name: r.product_name,
            order_id: r.order_id,
            user_id: r.user_id,
            customer_name: r.customer_name,
            customer_phone: r.customer_phone,
            rating: r.rating,
            review_title: r.review_title,
            review_text: r.review_text,
            image_url: r.image_url,
            is_verified_buyer: r.is_verified_buyer !== undefined ? r.is_verified_buyer : 1,
            is_approved: r.is_approved !== undefined ? r.is_approved : 1,
            created_at: r.created_at ? new Date(r.created_at) : new Date()
          },
          { upsert: true, new: true }
        );
      }
      console.log(`[MongoSync] Migrated ${existingReviews.length} product reviews to MongoDB Atlas.`);
    } catch (e) {
      console.warn("[MongoSync] Review migration notice:", e.message);
    }
  }

  // 8. Sync Contact Enquiries Collection
  const enquiryCount = await ContactEnquiry.countDocuments();
  if (enquiryCount === 0 && sqlite) {
    console.log("[MongoSync] Migrating customer inquiries to MongoDB Atlas...");
    try {
      const existingEnquiries = sqlite.prepare("SELECT * FROM enquiries").all();
      for (const eq of existingEnquiries) {
        await ContactEnquiry.create({
          id: eq.id,
          name: eq.name,
          phone: eq.phone,
          email: eq.email,
          subject: eq.subject,
          message: eq.message,
          status: eq.status || "new",
          created_at: eq.created_at ? new Date(eq.created_at) : new Date()
        });
      }
      console.log(`[MongoSync] Migrated ${existingEnquiries.length} customer enquiries to MongoDB Atlas.`);
    } catch (e) {
      console.warn("[MongoSync] Enquiry migration notice:", e.message);
    }
  }

  // 9. Sync Notifications Collection
  const notificationCount = await Notification.countDocuments();
  if (notificationCount === 0 && sqlite) {
    try {
      const existingNotifs = sqlite.prepare("SELECT * FROM notifications LIMIT 100").all();
      for (const n of existingNotifs) {
        await Notification.create({
          id: n.id,
          order_id: n.order_id,
          channel: n.channel,
          recipient: n.recipient,
          payload: n.payload,
          status: n.status || "sent",
          error_message: n.error_message,
          sent_at: n.sent_at ? new Date(n.sent_at) : null,
          created_at: n.created_at ? new Date(n.created_at) : new Date()
        });
      }
    } catch (e) {
      console.warn("[MongoSync] Notification migration notice:", e.message);
    }
  }

  // Ensure Carts collection has index on user_id and session_id
  await Cart.createIndexes().catch(() => {});
  await OtpRequest.createIndexes().catch(() => {});

  const finalSummary = {
    database: mongoose.connection.name,
    collections: {
      users: await User.countDocuments(),
      products: await Product.countDocuments(),
      categories: await Category.countDocuments(),
      carts: await Cart.countDocuments(),
      orders: await Order.countDocuments(),
      payments: await Payment.countDocuments(),
      addresses: await Address.countDocuments(),
      otp_requests: await OtpRequest.countDocuments(),
      reviews: await Review.countDocuments(),
      enquiries: await ContactEnquiry.countDocuments(),
      notifications: await Notification.countDocuments()
    }
  };

  console.log("==================================================");
  console.log(`[MongoSync] MONGODB ATLAS SYNC COMPLETE: "${finalSummary.database}"`);
  for (const [col, cnt] of Object.entries(finalSummary.collections)) {
    console.log(`  • ${col}: ${cnt} documents`);
  }
  console.log("==================================================");

  return { success: true, summary: finalSummary };
}

export default { syncMongoAtlas };
