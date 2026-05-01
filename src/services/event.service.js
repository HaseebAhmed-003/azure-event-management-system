const { getPrisma } = require("../lib/prisma");

/** =========================
 * CREATE EVENT
 * ========================= */
const createEvent = async (data, organizerId) => {
  const prisma = getPrisma();

  const eventDate = new Date(data.eventDate);
  if (isNaN(eventDate.getTime())) {
    throw { status: 400, message: "Invalid date" };
  }

  if (eventDate <= new Date()) {
    throw { status: 400, message: "Must be future date" };
  }

  const seats = Number(data.totalSeats);
  if (!Number.isInteger(seats) || seats < 1) {
    throw { status: 400, message: "Invalid seats" };
  }

  const price = Number(data.ticketPrice || 0);
  if (isNaN(price) || price < 0) {
    throw { status: 400, message: "Invalid price" };
  }

  return prisma.event.create({
    data: {
      title: data.title,
      description: data.description || null,
      venue: data.venue,
      eventDate,
      totalSeats: seats,
      availableSeats: seats,
      ticketPrice: price,
      isFree: price === 0,
      status: "DRAFT",
      organizerId,
    },
  });
};

/** =========================
 * LIST EVENTS (PUBLIC)
 * ========================= */
const listEvents = async ({ skip = 0, take = 50 } = {}) => {
  const prisma = getPrisma();

  return prisma.event.findMany({
    where: { status: "PUBLISHED" },
    skip,
    take,
    orderBy: { eventDate: "asc" },
  });
};

/** =========================
 * SEARCH EVENTS (PUBLIC)
 * Supports: ?search= ?from= ?to= ?venue=
 * ========================= */
const searchEvents = async ({ search, from, to, venue, skip = 0, take = 50 } = {}) => {
  const prisma = getPrisma();

  const where = { status: "PUBLISHED" };

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  if (venue) {
    where.venue = { contains: venue, mode: "insensitive" };
  }

  if (from || to) {
    where.eventDate = {};
    if (from) where.eventDate.gte = new Date(from);
    if (to)   where.eventDate.lte = new Date(to);
  }

  return prisma.event.findMany({
    where,
    skip,
    take,
    orderBy: { eventDate: "asc" },
  });
};

/** =========================
 * LIST ALL EVENTS (ADMIN)
 * ========================= */
const listAllEvents = async ({ skip = 0, take = 100 } = {}) => {
  const prisma = getPrisma();

  return prisma.event.findMany({
    skip,
    take,
    orderBy: { createdAt: "desc" },
  });
};

/** =========================
 * LIST EVENTS BY ORGANIZER
 * ========================= */
const listEventsByOrganizer = async (organizerId) => {
  const prisma = getPrisma();

  return prisma.event.findMany({
    where: { organizerId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { bookings: true, tickets: true },
      },
    },
  });
};

/** =========================
 * GET EVENT BY ID
 * ========================= */
const getEventById = async (id) => {
  const prisma = getPrisma();

  const event = await prisma.event.findUnique({
    where: { id: Number(id) },
  });

  if (!event) {
    throw { status: 404, message: "Event not found" };
  }

  return event;
};

/** =========================
 * GET EVENT WITH SEAT STATUS
 * ========================= */
const getEventWithSeatStatus = async (id) => {
  const prisma = getPrisma();

  const event = await prisma.event.findUnique({
    where: { id: Number(id) },
    include: {
      organizer: { select: { id: true, name: true, email: true } },
    },
  });

  if (!event) {
    throw { status: 404, message: "Event not found" };
  }

  return {
    ...event,
    seatsSold: event.totalSeats - event.availableSeats,
    seatsAvailable: event.availableSeats,
    isSoldOut: event.availableSeats === 0,
  };
};

/** =========================
 * GET EVENT DASHBOARD
 * Returns analytics for organizer view
 * ========================= */
const getEventDashboard = async (eventId) => {
  const prisma = getPrisma();

  const event = await prisma.event.findUnique({
    where: { id: Number(eventId) },
  });

  if (!event) {
    throw { status: 404, message: "Event not found" };
  }

  const [
    totalBookings,
    confirmedBookings,
    cancelledBookings,
    totalTickets,
    attendancePresent,
    revenueResult,
  ] = await Promise.all([
    prisma.booking.count({ where: { eventId: Number(eventId) } }),
    prisma.booking.count({ where: { eventId: Number(eventId), status: "CONFIRMED" } }),
    prisma.booking.count({ where: { eventId: Number(eventId), status: "CANCELLED" } }),
    prisma.ticket.count({ where: { eventId: Number(eventId) } }),
    prisma.attendance.count({ where: { eventId: Number(eventId), status: "PRESENT" } }),
    prisma.payment.aggregate({
      where: {
        booking: { eventId: Number(eventId) },
        status: "SUCCEEDED",
      },
      _sum: { amount: true },
    }),
  ]);

  const totalRevenue = Number(revenueResult._sum.amount || 0);
  const seatsSold = event.totalSeats - event.availableSeats;
  const attendanceRate = totalTickets > 0
    ? Math.round((attendancePresent / totalTickets) * 100)
    : 0;

  return {
    event,
    stats: {
      totalBookings,
      confirmedBookings,
      cancelledBookings,
      seatsSold,
      availableSeats: event.availableSeats,
      totalTickets,
      attendancePresent,
      attendanceRate,
      totalRevenue,
    },
  };
};

/** =========================
 * UPDATE EVENT
 * ========================= */
const updateEvent = async (id, data, user) => {
  const prisma = getPrisma();

  const event = await getEventById(id);

  if (event.organizerId !== user.id && user.role !== "ADMIN") {
    throw { status: 403, message: "Forbidden" };
  }

  return prisma.event.update({
    where: { id: Number(id) },
    data,
  });
};

/** =========================
 * PUBLISH EVENT
 * ========================= */
const publishEvent = async (id, user) => {
  const prisma = getPrisma();

  const event = await getEventById(id);

  if (event.organizerId !== user.id && user.role !== "ADMIN") {
    throw { status: 403, message: "Forbidden" };
  }

  if (!event.title || !event.venue || !event.eventDate) {
    throw { status: 400, message: "Event must have title, venue and date before publishing" };
  }

  return prisma.event.update({
    where: { id: Number(id) },
    data: { status: "PUBLISHED" },
  });
};

/** =========================
 * SET BANNER
 * ========================= */
const setBanner = async (id, bannerUrl, user) => {
  const prisma = getPrisma();

  const event = await getEventById(id);

  if (event.organizerId !== user.id && user.role !== "ADMIN") {
    throw { status: 403, message: "Forbidden" };
  }

  return prisma.event.update({
    where: { id: Number(id) },
    data: { bannerUrl },
  });
};

/** =========================
 * DELETE EVENT
 * Only allowed if no confirmed bookings exist
 * ========================= */
const deleteEvent = async (id, user) => {
  const prisma = getPrisma();

  const event = await getEventById(id);

  if (event.organizerId !== user.id && user.role !== "ADMIN") {
    throw { status: 403, message: "Forbidden" };
  }

  const confirmedBookings = await prisma.booking.count({
    where: { eventId: Number(id), status: "CONFIRMED" },
  });

  if (confirmedBookings > 0) {
    throw {
      status: 400,
      message: `Cannot delete event with ${confirmedBookings} confirmed booking(s). Cancel them first.`,
    };
  }

  // Delete in dependency order
  await prisma.attendance.deleteMany({ where: { eventId: Number(id) } });
  await prisma.ticket.deleteMany({ where: { eventId: Number(id) } });
  await prisma.payment.deleteMany({
    where: { booking: { eventId: Number(id) } },
  });
  await prisma.booking.deleteMany({ where: { eventId: Number(id) } });
  await prisma.event.delete({ where: { id: Number(id) } });

  return { message: `Event ${id} deleted` };
};

module.exports = {
  createEvent,
  listEvents,
  searchEvents,
  listAllEvents,
  listEventsByOrganizer,
  getEventById,
  getEventWithSeatStatus,
  getEventDashboard,
  updateEvent,
  publishEvent,
  setBanner,
  deleteEvent,
};