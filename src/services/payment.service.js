/**
 * Payment Service — Workflow 1 
 * Handles: Stripe Checkout session creation, webhook processing,
 * free-event auto-confirm, ticket generation trigger.
 */

const Stripe = require("stripe");
const prisma = require("../lib/prisma");
const ticketService = require("./ticket.service");
const emailService = require("./email.service");
const bookingService = require("./booking.service");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder");

// ── Create Stripe Checkout session ────────────────────────────────────

/** createPayment — creates a payment record for a booking. */
const createCheckoutSession = async (bookingId, userEmail) => {
  const booking = await bookingService.getBookingById(bookingId);

  if (booking.status !== "PENDING") {
    throw { status: 400, message: "Booking is not in pending state" };
  }

  // Free event — auto-confirm without Stripe
  if (parseFloat(booking.totalAmount) === 0) {
    return handleFreeBooking(booking, userEmail);
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `${booking.event.title}`,
            description: `${booking.quantity} ticket(s)`,
          },
          unit_amount: Math.round(parseFloat(booking.totalAmount) * 100),
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    customer_email: userEmail,
    success_url: `${process.env.APP_BASE_URL}/api/payments/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.APP_BASE_URL}/api/payments/cancel?booking_id=${bookingId}`,
    metadata: { bookingId: String(bookingId) },
  });

  // Persist session ID and create PENDING payment record
  await prisma.$transaction([
    prisma.booking.update({
      where: { id: bookingId },
      data: { stripeSessionId: session.id },
    }),
    prisma.payment.create({
      data: {
        bookingId,
        amount: booking.totalAmount,
        currency: "usd",
        status: "PENDING",
        stripeSessionId: session.id,
      },
    }),
  ]);

  return { checkoutUrl: session.url, stripeSessionId: session.id, bookingId };
};

// ── Handle free event bookings ────────────────────────────────────────
const handleFreeBooking = async (booking, userEmail) => {
  await prisma.$transaction([
    prisma.booking.update({ where: { id: booking.id }, data: { status: "CONFIRMED" } }),
    prisma.payment.create({
      data: {
        bookingId: booking.id,
        amount: 0,
        currency: "usd",
        status: "SUCCEEDED",
        paidAt: new Date(),
      },
    }),
  ]);

  // Refresh booking with relations
  const confirmedBooking = await bookingService.getBookingById(booking.id);
  const tickets = await ticketService.generateTicketsForBooking(confirmedBooking);

  emailService.sendBookingConfirmation(userEmail, confirmedBooking, tickets);

  return {
    checkoutUrl: `${process.env.APP_BASE_URL}/api/payments/success?booking_id=${booking.id}`,
    stripeSessionId: `free-${booking.id}`,
    bookingId: booking.id,
  };
};

// ── Stripe webhook handler ─────────────────────────────────────────────
const handleWebhook = async (rawBody, signature) => {
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    throw { status: 400, message: `Webhook signature error: ${err.message}` };
  }

  if (event.type === "checkout.session.completed") {
    await onPaymentSuccess(event.data.object);
  } else if (
    event.type === "payment_intent.payment_failed" ||
    event.type === "checkout.session.expired"
  ) {
    const bookingId = parseInt(event.data.object?.metadata?.bookingId || 0);
    if (bookingId) await onPaymentFailed(bookingId);
  }

  return { received: true };
};

const onPaymentSuccess = async (session) => {
  const bookingId = parseInt(session.metadata.bookingId);
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.status === "CONFIRMED") return;

  await prisma.$transaction([
    prisma.booking.update({ where: { id: bookingId }, data: { status: "CONFIRMED" } }),
    prisma.payment.updateMany({
      where: { bookingId },
      data: {
        status: "SUCCEEDED",
        stripePaymentIntent: session.payment_intent,
        paidAt: new Date(),
      },
    }),
  ]);

  const confirmedBooking = await bookingService.getBookingById(bookingId);
  const tickets = await ticketService.generateTicketsForBooking(confirmedBooking);
  emailService.sendBookingConfirmation(confirmedBooking.user.email, confirmedBooking, tickets);
};

const onPaymentFailed = async (bookingId) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { event: true },
  });
  if (!booking) return;

  await prisma.$transaction([
    prisma.booking.update({ where: { id: bookingId }, data: { status: "CANCELLED" } }),
    prisma.payment.updateMany({ where: { bookingId }, data: { status: "FAILED" } }),
    prisma.event.update({
      where: { id: booking.eventId },
      data: { availableSeats: { increment: booking.quantity } },
    }),
  ]);
};

// ── Read ──────────────────────────────────────────────────────────────
const getPaymentByBooking = async (bookingId) => {
  const payment = await prisma.payment.findUnique({ where: { bookingId } });
  if (!payment) throw { status: 404, message: "Payment record not found" };
  return payment;
};

const listAllPayments = async ({ skip = 0, take = 100 } = {}) => {
  return prisma.payment.findMany({
    skip, take,
    include: { booking: { select: { id: true, userId: true, eventId: true } } },
    orderBy: { createdAt: "desc" },
  });
};

// ── Simulated Payment ─────────────────────────────────────────────────
/** simulatePayment — instantly confirms/fails a booking without Stripe.
 * @param {number} bookingId - the booking to confirm or cancel
 * @param {boolean} succeed - true = confirm, false = cancel */
async function simulatePayment(bookingId, userEmail, succeed = true) {
  const booking = await bookingService.getBookingById(bookingId);

  if (booking.status === "CONFIRMED") {
    throw { status: 400, message: "Booking already confirmed" };
  }
  if (booking.status === "CANCELLED") {
    throw { status: 400, message: "Booking is cancelled" };
  }

  if (!succeed) {
    // Simulate failed payment — cancel booking, restore seats
    await onPaymentFailed(bookingId);
    return {
      success: false,
      message: "Simulated payment failure — booking cancelled, seats restored",
      bookingId,
    };
  }

  // Simulate successful payment
  await prisma.$transaction([
    prisma.booking.update({ where: { id: bookingId }, data: { status: "CONFIRMED" } }),
    prisma.payment.upsert({
      where: { bookingId },
      update: { status: "SUCCEEDED", paidAt: new Date() },
      create: {
        bookingId,
        amount:   booking.totalAmount,
        currency: "usd",
        status:   "SUCCEEDED",
        paidAt:   new Date(),
        stripePaymentIntent: `sim_${Date.now()}`,
      },
    }),
  ]);

  const confirmedBooking = await bookingService.getBookingById(bookingId);
  const tickets = await ticketService.generateTicketsForBooking(confirmedBooking);
  emailService.sendBookingConfirmation(userEmail, confirmedBooking, tickets);

  return {
    success: true,
    message: "Simulated payment success — booking confirmed, tickets generated, email sent",
    bookingId,
    ticketsGenerated: tickets.length,
    tickets: tickets.map((t) => ({ id: t.id, qrCode: t.qrCode, seatNumber: t.seatNumber })),
  };
}

module.exports = {
  createCheckoutSession, handleWebhook,
  getPaymentByBooking, listAllPayments,
  simulatePayment,
};