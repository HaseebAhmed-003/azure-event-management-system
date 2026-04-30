

const prisma = require("../lib/prisma");

/** createBooking — creates a booking record for a user. */
const createBooking = async ({ eventId, quantity }, userId) => {
  // ── Input validation ──────────────────────────────────────────────
 
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 1) {
    throw { status: 400, message: "Quantity must be a whole number of at least 1" };
  }
  if (qty > 10) {
    throw { status: 400, message: "Maximum 10 tickets per booking" };
  }

  const event = await prisma.event.findFirst({
    where: { id: eventId, status: "PUBLISHED" },
  });
  if (!event) throw { status: 404, message: "Event not found or not published" };
  if (event.availableSeats < qty) {
    throw {
      status: 400,
      message: `Only ${event.availableSeats} seats available, requested ${qty}`,
    };
  }

  const totalAmount = parseFloat(event.ticketPrice) * qty;

  // Reserve seats immediately — released if payment fails
  const [booking] = await prisma.$transaction([
    prisma.booking.create({
      data: { userId, eventId, quantity: qty, totalAmount, status: "PENDING" },
      include: { event: true, user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.event.update({
      where: { id: eventId },
      data: { availableSeats: { decrement: qty } },
    }),
  ]);

  return booking;
};

/** getBookingById — returns a single booking by ID. */
const getBookingById = async (id) => {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      event: true,
      user: { select: { id: true, name: true, email: true } },
      payment: true,
      tickets: true,
    },
  });
  if (!booking) throw { status: 404, message: "Booking not found" };
  return booking;
};

/** getUserBookings — returns all bookings made by a user. */
const listBookingsByUser = async (userId) => {
  return prisma.booking.findMany({
    where: { userId },
    include: { event: { select: { id: true, title: true, eventDate: true, venue: true } }, tickets: true },
    orderBy: { createdAt: "desc" },
  });
};

const listBookingsByEvent = async (eventId) => {
  return prisma.booking.findMany({
    where: { eventId },
    include: { user: { select: { id: true, name: true, email: true } }, tickets: true },
    orderBy: { createdAt: "desc" },
  });
};

const listAllBookings = async ({ skip = 0, take = 100 } = {}) => {
  return prisma.booking.findMany({
    skip, take,
    include: {
      user: { select: { id: true, name: true, email: true } },
      event: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
  });
};

const updateBookingStatus = async (id, status) => {
  return prisma.booking.update({ where: { id }, data: { status } });
};

/** cancelBooking — cancels a booking and restores seat count. */
const cancelBooking = async (id, userId) => {
  const booking = await getBookingById(id);
  if (booking.userId !== userId) {
    throw { status: 403, message: "You can only cancel your own bookings" };
  }
  if (booking.status === "CANCELLED") {
    throw { status: 400, message: "Booking already cancelled" };
  }

  await prisma.$transaction([
    prisma.booking.update({ where: { id }, data: { status: "CANCELLED" } }),
    // Restore seats only if booking was confirmed
    ...(booking.status === "CONFIRMED"
      ? [prisma.event.update({
          where: { id: booking.eventId },
          data: { availableSeats: { increment: booking.quantity } },
        })]
      : []),
  ]);

  return { message: `Booking ${id} cancelled` };
};

// Internal — called after payment succeeds
const confirmBooking = async (id) => {
  return prisma.booking.update({ where: { id }, data: { status: "CONFIRMED" } });
};

module.exports = {
  createBooking, getBookingById, listBookingsByUser,
  listBookingsByEvent, listAllBookings, updateBookingStatus,
  cancelBooking, confirmBooking,
};