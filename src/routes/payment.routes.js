/**
 * Payment Routes — Workflow 1 
 * POST   /api/payments/checkout/:bookingId  [Attendee]
 * POST   /api/payments/webhook              [Stripe only]
 * GET    /api/payments/success              [Stripe redirect]
 * GET    /api/payments/cancel               [Stripe redirect]
 * GET    /api/payments/booking/:bookingId   [Owner/Admin]
 * GET    /api/payments/admin/all            [Admin]
 */

const express = require("express");
const router = express.Router();
const paymentService = require("../services/payment.service");
const { authenticate, requireAdmin } = require("../middleware/auth.middleware");

// Stripe webhook — MUST use raw body (registered before express.json in index.js)
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const sig = req.headers["stripe-signature"];
      const result = await paymentService.handleWebhook(req.body, sig);
      res.json(result);
    } catch (err) {
      res.status(err.status || 400).json({ error: err.message });
    }
  }
);

// Create Stripe Checkout session 
router.post("/checkout/:bookingId", authenticate, async (req, res) => {
  try {
    const bookingId = parseInt(req.params.bookingId);
    const result = await paymentService.createCheckoutSession(bookingId, req.user.email);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ── SIMULATED PAYMENT ENDPOINT ────────────────────────────────────────
/** POST /api/payments/simulate/:bookingId - confirms or fails a booking. */
router.post("/simulate/:bookingId", authenticate, async (req, res) => {
  try {
    const bookingId  = parseInt(req.params.bookingId);
    const succeed    = req.body.success !== false;   // default to true if not specified
    const result     = await paymentService.simulatePayment(bookingId, req.user.email, succeed);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Stripe success redirect 
router.get("/success", (req, res) => {
  res.json({
    message: "Payment successful! Check your email for your QR code tickets.",
    sessionId: req.query.session_id,
    bookingId: req.query.booking_id,
  });
});

// Stripe cancel redirect
router.get("/cancel", (req, res) => {
  res.json({
    message: "Payment cancelled. Your seat reservation will be released shortly.",
    bookingId: req.query.booking_id,
  });
});

// Get payment record for a booking
router.get("/booking/:bookingId", authenticate, async (req, res) => {
  try {
    const payment = await paymentService.getPaymentByBooking(parseInt(req.params.bookingId));
    res.json(payment);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// [Admin] list all payments
router.get("/admin/all", authenticate, requireAdmin, async (req, res) => {
  try {
    const payments = await paymentService.listAllPayments({
      skip: parseInt(req.query.skip) || 0,
      take: parseInt(req.query.take) || 100,
    });
    res.json(payments);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;