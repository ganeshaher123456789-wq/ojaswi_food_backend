import bcrypt from "bcryptjs";
import { db } from "../config/db.js";
import { initDatabase } from "./init.js";
import { ENV } from "../config/env.js";

export const INITIAL_PRODUCTS = [
  {
    name: "Garam Masala",
    slug: "garam-masala",
    product_number: "01 / PREMIUM",
    sku: "OJ-GM-01",
    category: "Blended Masala",
    location: "52/2, Malegaon - 423203, Nashik, Maharashtra, India",
    description: "A rich aromatic blend of traditional whole spices for deeply flavourful Indian dishes. Made with pure coriander, cumin, black pepper, cardamom, cinnamon and cloves roasted to perfection.",
    price: 199,
    mrp: 249,
    selling_price: 199,
    weight: "NET WEIGHT 500g",
    image: "images/garam-masala.jpeg",
    image_backup: "images/garam-masala.jpeg",
    images: [
      "images/garam-masala.jpeg",
      "images/WhatsApp Image 2026-09-10 at 10.01.48 PM.jpeg"
    ],
    stock: 120,
    is_active: 1
  },
  {
    name: "Kitchen King Masala",
    slug: "kitchen-king-masala",
    product_number: "02 / PREMIUM",
    sku: "OJ-KK-02",
    category: "Curry & Gravy Special",
    location: "52/2, Malegaon - 423203, Nashik, Maharashtra, India",
    description: "A versatile masala blend designed to add colour, warmth and character to everyday vegetables and gravies. The all-in-one kitchen essential for authentic royal flavours.",
    price: 199,
    mrp: 249,
    selling_price: 199,
    weight: "NET WEIGHT 500g",
    image: "images/kitchen-king.jpeg",
    image_backup: "images/kitchen-king.jpeg",
    images: [
      "images/kitchen-king.jpeg",
      "images/WhatsApp Image 2026-09-10 at 10.02.02 PM.jpeg"
    ],
    stock: 100,
    is_active: 1
  },
  {
    name: "Sabji Masala",
    slug: "sabji-masala",
    product_number: "03 / PREMIUM",
    sku: "OJ-SM-03",
    category: "Everyday Sabji",
    location: "52/2, Malegaon - 423203, Nashik, Maharashtra, India",
    description: "A balanced spice blend for delicious everyday vegetable preparations. Crafted to enhance natural flavours with mild warmth and appetizing golden colour.",
    price: 199,
    mrp: 249,
    selling_price: 199,
    weight: "NET WEIGHT 500g",
    image: "images/sabji-masala.jpeg",
    image_backup: "images/sabji-masala.jpeg",
    images: [
      "images/sabji-masala.jpeg",
      "images/WhatsApp Image 2026-09-10 at 10.04.46 PM.jpeg"
    ],
    stock: 150,
    is_active: 1
  },
  {
    name: "Chaat Masala",
    slug: "chaat-masala",
    product_number: "04 / PREMIUM",
    sku: "OJ-CM-04",
    category: "Snack & Chaat Spices",
    location: "52/2, Malegaon - 423203, Nashik, Maharashtra, India",
    description: "A tangy, aromatic blend that gives snacks, fruits, salads and chaats an irresistible finishing touch. Features roasted cumin, black salt, amchur and mint.",
    price: 199,
    mrp: 249,
    selling_price: 199,
    weight: "NET WEIGHT 500g",
    image: "images/chaat-masala.jpeg",
    image_backup: "images/chaat-masala.jpeg",
    images: [
      "images/chaat-masala.jpeg",
      "images/WhatsApp Image 2026-09-10 at 10.06.18 PM.jpeg"
    ],
    stock: 110,
    is_active: 1
  },
  {
    name: "Biryani Masala",
    slug: "biryani-masala",
    product_number: "05 / PREMIUM",
    sku: "OJ-BM-05",
    category: "Royal Rice & Biryani",
    location: "52/2, Malegaon - 423203, Nashik, Maharashtra, India",
    description: "An aromatic combination of exotic whole spices crafted for rich, fragrant biryani. Infused with shahi jeera, star anise, mace, nutmeg, cinnamon and green cardamom.",
    price: 199,
    mrp: 249,
    selling_price: 199,
    weight: "NET WEIGHT 500g",
    image: "images/biryani-masala.jpeg",
    image_backup: "images/biryani-masala.jpeg",
    images: [
      "images/biryani-masala.jpeg",
      "images/WhatsApp Image 2026-09-10 at 10.07.44 PM.jpeg"
    ],
    stock: 130,
    is_active: 1
  },
  {
    name: "Pav Bhaji Masala",
    slug: "pav-bhaji-masala",
    product_number: "06 / PREMIUM",
    sku: "OJ-PB-06",
    category: "Street Food Specialty",
    location: "52/2, Malegaon - 423203, Nashik, Maharashtra, India",
    description: "A bold Maharashtrian-inspired blend made for rich, buttery pav bhaji with authentic street-food aroma, vibrant color, and deep savoury taste.",
    price: 199,
    mrp: 249,
    selling_price: 199,
    weight: "NET WEIGHT 500g",
    image: "images/pav-bhaji.jpeg",
    image_backup: "images/pav-bhaji.jpeg",
    images: [
      "images/pav-bhaji.jpeg",
      "images/WhatsApp Image 2026-09-10 at 10.08.50 PM.jpeg"
    ],
    stock: 140,
    is_active: 1
  },
  {
    name: "Misal Masala",
    slug: "misal-masala",
    product_number: "07 / PREMIUM",
    sku: "OJ-MM-07",
    category: "Maharashtrian Specialty",
    location: "52/2, Malegaon - 423203, Nashik, Maharashtra, India",
    description: "A vibrant spice blend for authentic, flavour-packed Maharashtrian misal. Yields rich tari (kat) with signature heat, aroma and unbeatable spicy depth.",
    price: 199,
    mrp: 249,
    selling_price: 199,
    weight: "NET WEIGHT 500g",
    image: "images/misal-masala.jpeg",
    image_backup: "images/misal-masala.jpeg",
    images: [
      "images/misal-masala.jpeg",
      "images/WhatsApp Image 2026-09-10 at 10.11.33 PM.jpeg"
    ],
    stock: 95,
    is_active: 1
  },
  {
    name: "Rajma Masala",
    slug: "rajma-masala",
    product_number: "08 / PREMIUM",
    sku: "OJ-RM-08",
    category: "North Indian Specialty",
    location: "52/2, Malegaon - 423203, Nashik, Maharashtra, India",
    description: "A deeply aromatic, North Indian spice blend specially crafted for rich and luscious Punjabi rajma curry. Freshly stone-ground from selected harvest spice lots.",
    price: 199,
    mrp: 249,
    selling_price: 199,
    weight: "NET WEIGHT 500g",
    image: "images/rajma-masala.jpeg",
    image_backup: "images/spice-08.jpeg",
    images: [
      "images/rajma-masala.jpeg",
      "images/spice-08.jpeg",
      "images/WhatsApp Image 2026-09-25 at 5.23.33 PM.jpeg"
    ],
    stock: 80,
    is_active: 1
  },
  {
    name: "Chole Masala",
    slug: "chole-masala",
    product_number: "09 / PREMIUM",
    sku: "OJ-CM-09",
    category: "Punjabi Specialty",
    location: "52/2, Malegaon - 423203, Nashik, Maharashtra, India",
    description: "A tangy, robustly spiced masala crafted for authentic Amritsari and Punjabi chole with irresistible aroma. Slow dry-roasted whole spices sealed in freshness packaging.",
    price: 199,
    mrp: 249,
    selling_price: 199,
    weight: "NET WEIGHT 500g",
    image: "images/chole-masala.jpeg",
    image_backup: "images/spice-09.jpeg",
    images: [
      "images/chole-masala.jpeg",
      "images/spice-09.jpeg",
      "images/WhatsApp Image 2026-09-25 at 5.23.30 PM.jpeg"
    ],
    stock: 85,
    is_active: 1
  },
  {
    name: "Rasam Masala",
    slug: "rasam-masala",
    product_number: "10 / PREMIUM",
    sku: "OJ-RS-10",
    category: "South Indian Specialty",
    location: "52/2, Malegaon - 423203, Nashik, Maharashtra, India",
    description: "A fragrant South Indian blend of roasted lentils, pepper, cumin and spices for comforting traditional rasam. Unadulterated, preservative-free recipe with intense natural spice oils.",
    price: 199,
    mrp: 249,
    selling_price: 199,
    weight: "NET WEIGHT 500g",
    image: "images/rasam-masala.jpeg",
    image_backup: "images/spice-10.jpeg",
    images: [
      "images/rasam-masala.jpeg",
      "images/spice-10.jpeg",
      "images/WhatsApp Image 2026-09-25 at 5.23.31 PM.jpeg"
    ],
    stock: 90,
    is_active: 1
  },
  {
    name: "Sambar Masala",
    slug: "sambar-masala",
    product_number: "11 / PREMIUM",
    sku: "OJ-SM-11",
    category: "South Indian Heritage",
    location: "52/2, Malegaon - 423203, Nashik, Maharashtra, India",
    description: "An authentic South Indian blend of freshly roasted spices and dals for rich, aromatic and appetizing sambar. Elevates homestyle cooking to gourmet standards.",
    price: 199,
    mrp: 249,
    selling_price: 199,
    weight: "NET WEIGHT 500g",
    image: "images/sambar-masala.jpeg",
    image_backup: "images/spice-11.jpeg",
    images: [
      "images/sambar-masala.jpeg",
      "images/spice-11.jpeg",
      "images/WhatsApp Image 2026-09-25 at 5.23.32 PM.jpeg"
    ],
    stock: 75,
    is_active: 1
  }
];

export async function seedDatabase() {
  await initDatabase();

  // Seed or update products
  console.log("[DB] Syncing Ojaswi products...");
  for (const p of INITIAL_PRODUCTS) {
    const imagesJson = JSON.stringify(p.images);
    const existing = await db.get("SELECT id FROM products WHERE product_number = $1 OR name = $2", [p.product_number, p.name]);

    if (!existing) {
      await db.run(
        `INSERT INTO products (name, slug, product_number, sku, category, location, description, price, mrp, selling_price, weight, image, image_backup, images_json, stock, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
        [
          p.name,
          p.slug,
          p.product_number,
          p.sku,
          p.category,
          p.location,
          p.description,
          p.price,
          p.mrp,
          p.selling_price,
          p.weight,
          p.image,
          p.image_backup,
          imagesJson,
          p.stock,
          p.is_active
        ]
      );
    } else {
      await db.run(
        `UPDATE products 
         SET name = $1, slug = $2, product_number = $3, sku = $4, category = $5, location = $6, images_json = $7, description = $8, mrp = $9, selling_price = $10, image = $11, image_backup = $12
         WHERE id = $13`,
        [
          p.name,
          p.slug,
          p.product_number,
          p.sku,
          p.category,
          p.location,
          imagesJson,
          p.description,
          p.mrp,
          p.selling_price,
          p.image,
          p.image_backup,
          existing.id
        ]
      );
    }
  }
  console.log(`[DB] Successfully synced ${INITIAL_PRODUCTS.length} Ojaswi products.`);

  // Seed Admin user
  const admin = await db.get("SELECT id FROM admin_users WHERE username = $1", [ENV.ADMIN_DEFAULT_USER]);
  if (!admin) {
    console.log(`[DB] Creating default admin user (${ENV.ADMIN_DEFAULT_USER})...`);
    const passwordHash = await bcrypt.hash(ENV.ADMIN_DEFAULT_PASSWORD, 10);
    await db.run(
      `INSERT INTO admin_users (username, email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        ENV.ADMIN_DEFAULT_USER,
        ENV.ADMIN_DEFAULT_EMAIL,
        passwordHash,
        "Ojaswi Administrator",
        "admin"
      ]
    );
    console.log("[DB] Admin user created successfully.");
  }

  // Seed Initial Verified Product Reviews with real spice photos
  const existingReviews = await db.get("SELECT COUNT(*) as count FROM reviews");
  if (!existingReviews || existingReviews.count === 0) {
    const sampleReviews = [
      {
        product_id: 1,
        product_name: "Garam Masala",
        customer_name: "Rajesh Kulkarni",
        customer_phone: "9822100455",
        rating: 5,
        review_title: "Pure unadulterated aroma - reminds me of ancestral cooking",
        review_text: "Ordered from Nashik, reached in 2 days. The aroma when you open the seal is extraordinary. Stone-ground quality is clearly visible in the texture and color of the curry.",
        image_url: "images/WhatsApp Image 2026-09-10 at 10.01.48 PM.jpeg",
        is_verified_buyer: 1
      },
      {
        product_id: 2,
        product_name: "Kitchen King Masala",
        customer_name: "Sunita Deshmukh",
        customer_phone: "9423589123",
        rating: 5,
        review_title: "Best all-rounder spice for daily gravies!",
        review_text: "My family loved the paneer masala made with this blend. Perfectly balanced warmth without unnecessary artificial colors. 10/10 quality from Malegaon!",
        image_url: "images/WhatsApp Image 2026-09-10 at 10.02.02 PM.jpeg",
        is_verified_buyer: 1
      },
      {
        product_id: 5,
        product_name: "Biryani Masala",
        customer_name: "Chef Amit Patil",
        customer_phone: "9175402891",
        rating: 5,
        review_title: "Authentic Shahi aroma with whole mace & cardamom",
        review_text: "We used this for Sunday Dum Biryani for 12 guests. Everyone praised the royal aroma. Packet arrived hermetically sealed and completely fresh.",
        image_url: "images/WhatsApp Image 2026-09-10 at 10.07.44 PM.jpeg",
        is_verified_buyer: 1
      },
      {
        product_id: 6,
        product_name: "Pav Bhaji Masala",
        customer_name: "Pooja Wagh",
        customer_phone: "9850123789",
        rating: 5,
        review_title: "Real Mumbai street-style taste at home",
        review_text: "Rich buttery taste and deep appetizing colour. My kids finished their entire plates. Will be ordering more packets for Diwali!",
        image_url: "images/WhatsApp Image 2026-09-10 at 10.08.50 PM.jpeg",
        is_verified_buyer: 1
      },
      {
        product_id: 7,
        product_name: "Misal Masala",
        customer_name: "Ganesh Shelar",
        customer_phone: "9763214589",
        rating: 5,
        review_title: "Authentic spicy Nashik/Khandesh Misal tarri",
        review_text: "Perfect fiery red rassa tarri without any sourness. Genuine Malegaon quality. Delivered promptly right to my doorstep.",
        image_url: "images/WhatsApp Image 2026-09-10 at 10.11.33 PM.jpeg",
        is_verified_buyer: 1
      }
    ];

    for (const r of sampleReviews) {
      await db.run(
        `INSERT INTO reviews (product_id, product_name, customer_name, customer_phone, rating, review_title, review_text, image_url, is_verified_buyer, is_approved)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1)`,
        [r.product_id, r.product_name, r.customer_name, r.customer_phone, r.rating, r.review_title, r.review_text, r.image_url, r.is_verified_buyer]
      );
    }
    console.log(`[DB] Seeded ${sampleReviews.length} verified customer reviews with photos.`);
  }
}

// Allow direct execution
if (process.argv[1]?.endsWith("seed.js")) {
  seedDatabase()
    .then(() => {
      console.log("[DB] Seeding process complete.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[DB] Seeding failed:", err);
      process.exit(1);
    });
}
