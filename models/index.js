export { User } from "./User.js";
export { Product } from "./Product.js";
export { Category } from "./Category.js";
export { Cart } from "./Cart.js";
export { Order } from "./Order.js";
export { Payment } from "./Payment.js";
export { Address } from "./Address.js";
export { CustomerProfile } from "./CustomerProfile.js";
export { Review } from "./Review.js";
export { OtpRequest } from "./OtpRequest.js";
export { ContactEnquiry } from "./ContactEnquiry.js";
export { Notification } from "./Notification.js";

export default {
  User: () => import("./User.js").then((m) => m.User),
  Product: () => import("./Product.js").then((m) => m.Product),
  Category: () => import("./Category.js").then((m) => m.Category),
  Cart: () => import("./Cart.js").then((m) => m.Cart),
  Order: () => import("./Order.js").then((m) => m.Order),
  Payment: () => import("./Payment.js").then((m) => m.Payment),
  Address: () => import("./Address.js").then((m) => m.Address),
  CustomerProfile: () => import("./CustomerProfile.js").then((m) => m.CustomerProfile),
  Review: () => import("./Review.js").then((m) => m.Review),
  OtpRequest: () => import("./OtpRequest.js").then((m) => m.OtpRequest),
  ContactEnquiry: () => import("./ContactEnquiry.js").then((m) => m.ContactEnquiry),
  Notification: () => import("./Notification.js").then((m) => m.Notification)
};
