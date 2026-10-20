import express from "express";
import { db } from "../config/db.js";
import { ContactEnquiry } from "../models/index.js";
import { validateIndianPhone, validateEmail } from "../utils/helpers.js";

const router = express.Router();

/**
 * POST /api/contact
 * Handles contact form submissions, saving to MongoDB Atlas
 */
router.post("/", async (req, res, next) => {
  try {
    const { name, phone, email, subject, message } = req.body;

    if (!name || !phone || !message) {
      return res.status(400).json({
        success: false,
        error: "Please provide your Name, Phone Number, and Message."
      });
    }

    const cleanPhone = validateIndianPhone(phone);
    if (!cleanPhone) {
      return res.status(400).json({
        success: false,
        error: "Please enter a valid 10-digit Indian phone number."
      });
    }

    if (email && !validateEmail(email)) {
      return res.status(400).json({
        success: false,
        error: "Please enter a valid email address."
      });
    }

    // Save in SQL database
    await db.run(
      `INSERT INTO enquiries (name, phone, email, subject, message)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        name.trim(),
        cleanPhone,
        email ? email.trim().toLowerCase() : null,
        subject ? subject.trim() : "Website Enquiry",
        message.trim()
      ]
    );

    // Save in MongoDB Atlas
    try {
      await ContactEnquiry.create({
        name: name.trim(),
        phone: cleanPhone,
        email: email ? email.trim().toLowerCase() : null,
        subject: subject ? subject.trim() : "Website Enquiry",
        message: message.trim(),
        status: "new"
      });
    } catch (mErr) {
      console.warn("[MongoDB] Contact enquiry sync notice:", mErr.message);
    }

    console.log(`[Contact] New enquiry from ${name} (${cleanPhone}): ${subject}`);

    res.json({
      success: true,
      message: "Thank you for contacting Ojaswi Foods! We have received your message and will get back to you shortly."
    });
  } catch (err) {
    next(err);
  }
});

export default router;
