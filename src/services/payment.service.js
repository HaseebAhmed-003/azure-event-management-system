const Stripe = require("stripe");
const { getPrisma } = require("../lib/prisma");
const ticketService = require("./ticket.service");
const emailService = require("./email.service");
const bookingService = require("./booking.service");

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY || "sk_test_placeholder"
);

/** SAFE DB ACCESS */
const getDB = () => {
  const prisma = getPrisma();
  if (!prisma) throw new Error("Prisma client not initialized");
  return prisma;
};

/** =========================
 * STRIPE CHECKOUT
 * ========================= */
const createCheckoutSession = async (bookingId, userEmail) => {
  const prisma = getDB();

  const booking = await bookingService.getBookingById(bookingId);

  if (booking.status !== "PENDING") {
    throw { status: 400, message: "Booking is not pending" };
  }

  if (Number(booking.totalAmount) === 0) {
    return handleFreeBooking(booking, userEmail);
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: booking.event.title,
            description: `${booking.quantity} ticket(s)`,
          },
          unit_amount: Math.round(Number(booking.totalAmount) * 100),
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

  return {
    checkoutUrl: session.url,
    stripeSessionId: session.id,
    bookingId,
  };
};

/** =========================
 * FREE BOOKINGS
 * ========================= */
const handleFreeBooking = async (booking, userEmail) => {
  const prisma = getDB();

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: booking.id },
      data: { status: "CONFIRMED" },
    }),
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

  const confirmed = await bookingService.getBookingById(booking.id);
  const tickets = await ticketService.generateTicketsForBooking(confirmed);

  emailService.sendBookingConfirmation(userEmail, confirmed, tickets);

  return {
    checkoutUrl: `${process.env.APP_BASE_URL}/api/payments/success?booking_id=${booking.id}`,
    stripeSessionId: `free-${booking.id}`,
    bookingId: booking.id,
  };
};

/** =========================
 * WEBHOOK
 * ========================= */
const handleWebhook = async (rawBody, signature) => {
  const prisma = getDB();

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    throw { status: 400, message: err.message };
  }

  if (event.type === "checkout.session.completed") {
    await onPaymentSuccess(event.data.object);
  }

  if (
    event.type === "payment_intent.payment_failed" ||
    event.type === "checkout.session.expired"
  ) {
    const bookingId = Number(event.data.object?.metadata?.bookingId || 0);
    if (bookingId) await onPaymentFailed(bookingId);
  }

  return { received: true };
};

/** =========================
 * SUCCESS
 * ========================= */
const onPaymentSuccess = async (session) => {
  const prisma = getDB();

  const bookingId = Number(session.metadata.bookingId);

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking || booking.status === "CONFIRMED") return;

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: bookingId },
      data: { status: "CONFIRMED" },
    }),
    prisma.payment.updateMany({
      where: { bookingId },
      data: {
        status: "SUCCEEDED",
        stripePaymentIntent: session.payment_intent,
        paidAt: new Date(),
      },
    }),
  ]);

  const confirmed = await bookingService.getBookingById(bookingId);
  const tickets = await ticketService.generateTicketsForBooking(confirmed);

  emailService.sendBookingConfirmation(
    confirmed.user.email,
    confirmed,
    tickets
  );
};

/** =========================
 * FAILURE
 * ========================= */
const onPaymentFailed = async (bookingId) => {
  const prisma = getDB();

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) return;

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: bookingId },
      data: { status: "CANCELLED" },
    }),
    prisma.payment.updateMany({
      where: { bookingId },
      data: { status: "FAILED" },
    }),
    prisma.event.update({
      where: { id: booking.eventId },
      data: {
        availableSeats: { increment: booking.quantity },
      },
    }),
  ]);
};

/** =========================
 * READ
 * ========================= */
const getPaymentByBooking = async (bookingId) => {
  const prisma = getDB();

  const payment = await prisma.payment.findUnique({
    where: { bookingId },
  });

  if (!payment) {
    throw { status: 404, message: "Payment not found" };
  }

  return payment;
};

const listAllPayments = async ({ skip = 0, take = 100 } = {}) => {
  const prisma = getDB();

  return prisma.payment.findMany({
    skip,
    take,
    include: {
      booking: {
        select: { id: true, userId: true, eventId: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};

/** =========================
 * SIMULATE PAYMENT
 * ========================= */
const simulatePayment = async (bookingId, userEmail, succeed = true) => {
  const prisma = getDB();

  const booking = await bookingService.getBookingById(bookingId);

  if (booking.status === "CONFIRMED") {
    throw { status: 400, message: "Already confirmed" };
  }

  if (booking.status === "CANCELLED") {
    throw { status: 400, message: "Already cancelled" };
  }

  if (!succeed) {
    await onPaymentFailed(bookingId);
    return { success: false, message: "Payment failed" };
  }

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: bookingId },
      data: { status: "CONFIRMED" },
    }),
    prisma.payment.upsert({
      where: { bookingId },
      update: { status: "SUCCEEDED", paidAt: new Date() },
      create: {
        bookingId,
        amount: booking.totalAmount,
        currency: "usd",
        status: "SUCCEEDED",
        paidAt: new Date(),
        stripePaymentIntent: `sim_${Date.now()}`,
      },
    }),
  ]);

  const confirmed = await bookingService.getBookingById(bookingId);
  const tickets = await ticketService.generateTicketsForBooking(confirmed);

  emailService.sendBookingConfirmation(userEmail, confirmed, tickets);

  return {
    success: true,
    ticketsGenerated: tickets.length,
  };
};

module.exports = {
  createCheckoutSession,
  handleWebhook,
  getPaymentByBooking,
  listAllPayments,
  simulatePayment,
};