import mongoose from "mongoose";
import { connectMongo } from "../config/mongodb.js";
import { Product, Category } from "../models/index.js";
import { INITIAL_PRODUCTS } from "../database/seed.js";

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

async function seedCatalog() {
  console.log("==================================================");
  console.log("  SEEDING OFFICIAL OJASWI CATALOG TO MONGO ATLAS  ");
  console.log("==================================================");

  let attempts = 0;
  let connected = false;
  while (attempts < 4 && !connected) {
    try {
      attempts++;
      console.log(`Connecting to MongoDB Atlas (attempt ${attempts}/4)...`);
      const status = await connectMongo();
      if (status.connected) {
        connected = true;
      }
    } catch (e) {
      console.warn(`Connection attempt ${attempts} failed: ${e.message}`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  if (!connected) {
    throw new Error("Could not connect to MongoDB Atlas after 4 attempts");
  }

  console.log("Connected to MongoDB Atlas successfully.");

  // 1. Seed Products
  console.log(`Upserting ${INITIAL_PRODUCTS.length} official spice products...`);
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
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
  }
  const productCount = await Product.countDocuments();
  console.log(`✓ Products seeded. Total products in Atlas: ${productCount}`);

  // 2. Seed Categories
  console.log(`Upserting ${CATEGORY_METADATA.length} official categories...`);
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
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
  }
  const categoryCount = await Category.countDocuments();
  console.log(`✓ Categories seeded. Total categories in Atlas: ${categoryCount}`);

  console.log("==================================================");
  console.log("  CATALOG SEEDING COMPLETED CLEANLY! NO USER DATA ");
  console.log("==================================================");
  await mongoose.disconnect();
}

seedCatalog().catch(err => {
  console.error("Failed to seed catalog:", err);
  process.exit(1);
});
