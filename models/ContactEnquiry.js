import mongoose from "mongoose";

const contactEnquirySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    subject: { type: String },
    message: { type: String, required: true },
    status: { type: String, default: "new" }
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: false }
  }
);

export const ContactEnquiry = mongoose.models.ContactEnquiry || mongoose.model("ContactEnquiry", contactEnquirySchema);
export default ContactEnquiry;
