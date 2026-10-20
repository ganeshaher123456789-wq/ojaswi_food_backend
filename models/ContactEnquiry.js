import mongoose from "mongoose";

const contactEnquirySchema = new mongoose.Schema(
  {
    id: { type: Number, index: true },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    subject: { type: String },
    message: { type: String, required: true },
    status: { type: String, default: "new", index: true }
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
  }
);

export const ContactEnquiry = mongoose.models.ContactEnquiry || mongoose.model("ContactEnquiry", contactEnquirySchema, "enquiries");
export default ContactEnquiry;
