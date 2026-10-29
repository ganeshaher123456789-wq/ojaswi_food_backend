/**
 * Ojaswi Foods / Ojaswi Premium Spices
 * Official Business Constants & Configuration
 * 
 * Preserves the exact business location, FSSAI license, phone and email from the source site.
 */

export const OJASWI_CONSTANTS = {
  BRAND_NAME: "Ojaswi Premium",
  COMPANY_NAME: "Ojaswi Foods",
  PACKED_BY: "Ojaswi Foods, 52/2, Malegaon - 423203",
  LOCATION_FULL: "52/2, Malegaon - 423203, Nashik, Maharashtra, India",
  PINCODE: "423203",
  CITY: "Malegaon",
  DISTRICT: "Nashik",
  STATE: "Maharashtra",
  COUNTRY: "India",

  // Verified official registrations from index3.html
  FSSAI_LICENSE: "3025120612245599988",
  PHONE: "917620098478",
  DISPLAY_PHONE: "+91 7620098478",
  EMAIL: "ojaswifoods@gmail.com",
  MAPS_QUERY_URL: "https://www.google.com/maps?q=Ojaswi%20Foods%2C%2052%2F2%2C%20Malegaon%2C%20423203",
  MAPS_EMBED_URL: "https://www.google.com/maps?q=Ojaswi%20Foods%2C%2052%2F2%2C%20Malegaon%2C%20423203&output=embed",

  // Lifecycle Order Statuses
  ORDER_STATUSES: [
    "Pending",
    "Confirmed",
    "Processing",
    "Packed",
    "Shipped",
    "Out for Delivery",
    "Delivered",
    "Cancelled"
  ],

  // Payment Methods & Statuses
  PAYMENT_METHODS: {
    COD: "Cash on Delivery",
    ONLINE: "Online Payment"
  },

  PAYMENT_STATUSES: {
    COD_PENDING: "Payment Pending — Cash on Delivery",
    PAID: "Paid",
    FAILED: "Failed",
    REFUNDED: "Refunded"
  },

  // E-Commerce Store Defaults
  DEFAULT_DELIVERY_CHARGE: 0, // Free Delivery on all premium orders
  CURRENCY: "INR",
  CURRENCY_SYMBOL: "₹",
  MIN_ORDER_AMOUNT: 99
};
