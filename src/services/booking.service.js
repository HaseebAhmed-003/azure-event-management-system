const { getPrisma } = require("../lib/prisma");

/** FIX: create single prisma instance (prevents "prisma is not defined") */

/** createBooking */
const createBooking = async ({ eventId, quantity }, userId) => {
  const prisma = getPrisma(); 
  const qty = Number(quantity);

  if (!Number.isInteger(qty) || qty < 1) {
    throw { status: 400, message: "Quantity must be at least 1" };
  }

  if (qty > 10) {
    throw { status: 400, message: "Max 10 tickets allowed" };
  }

  const event = await prisma.event.findFirst({
    where: { id: eventId, status: "PUBLISHED" },
  });

  if (!event) {
    throw { status: 404, message: "Event not found" };
  }

  if (event.availableSeats < qty) {
    throw {
      status: 400,
      message: `Only ${event.availableSeats} seats available`,
    };
  }

  const totalAmount = Number(event.ticketPrice) * qty;

  const [booking] = await prisma.$transaction([
    prisma.booking.create({
      data: {
        userId,
        eventId,
        quantity: qty,
        totalAmount,
        status: "PENDING",
      },
      include: {
        event: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),

    prisma.event.update({
      where: { id: eventId },
      data: {
        availableSeats: { decrement: qty },
      },
    }),
  ]);

  return booking;
};

/** getBookingById */
const getBookingById = async (id) => {
  const prisma = getPrisma(); 
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      event: true,
      user: { select: { id: true, name: true, email: true } },
      payment: true,
      tickets: true,
    },
  });

  if (!booking) {
    throw { status: 404, message: "Booking not found" };
  }

  return booking;
};

/** listBookingsByUser */
const listBookingsByUser = async (userId) => {
  const prisma = getPrisma(); 
  return prisma.booking.findMany({
    where: { userId },
    include: {
      event: {
        select: {
          id: true,
          title: true,
          eventDate: true,
          venue: true,
        },
      },
      tickets: true,
    },
    orderBy: { createdAt: "desc" },
  });
};

/** listBookingsByEvent */
const listBookingsByEvent = async (eventId) => {
  const prisma = getPrisma(); 
  return prisma.booking.findMany({
    where: { eventId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      tickets: true,
    },
    orderBy: { createdAt: "desc" },
  });
};

/** listAllBookings */
const listAllBookings = async ({ skip = 0, take = 100 } = {}) => {
  const prisma = getPrisma(); 
  return prisma.booking.findMany({
    skip,
    take,
    include: {
      user: { select: { id: true, name: true, email: true } },
      event: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
  });
};

/** updateBookingStatus */
const updateBookingStatus = async (id, status) => {
  const prisma = getPrisma(); 
  return prisma.booking.update({
    where: { id },
    data: { status },
  });
};

/** cancelBooking */
const cancelBooking = async (id, userId) => {
  const prisma = getPrisma(); 
  const booking = await getBookingById(id);

  if (booking.userId !== userId) {
    throw { status: 403, message: "Not allowed" };
  }

  if (booking.status === "CANCELLED") {
    throw { status: 400, message: "Already cancelled" };
  }

  await prisma.$transaction([
    prisma.booking.update({
      where: { id },
      data: { status: "CANCELLED" },
    }),

    ...(booking.status === "CONFIRMED"
      ? [
          prisma.event.update({
            where: { id: booking.eventId },
            data: {
              availableSeats: { increment: booking.quantity },
            },
          }),
        ]
      : []),
  ]);

  return { message: "Booking cancelled" };
};

/** confirmBooking */
const confirmBooking = async (id) => {
  const prisma = getPrisma(); 
  return prisma.booking.update({
    where: { id },
    data: { status: "CONFIRMED" },
  });
};

module.exports = {
  createBooking,
  getBookingById,
  listBookingsByUser,
  listBookingsByEvent,
  listAllBookings,
  updateBookingStatus,
  cancelBooking,
  confirmBooking,
};