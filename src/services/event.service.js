const { getPrisma } = require("../lib/prisma");

// FIX: create prisma instance ONCE in this file scope
// (prevents undefined prisma + avoids repeated connections)
const prisma = getPrisma();

/** =========================
 * CREATE EVENT
 * ========================= */
const createEvent = async (data, organizerId) => {
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
  return prisma.event.findMany({
    where: { status: "PUBLISHED" },
    skip,
    take,
    orderBy: { eventDate: "asc" },
  });
};

/** =========================
 * LIST ALL EVENTS (ADMIN)
 * ========================= */
const listAllEvents = async ({ skip = 0, take = 100 } = {}) => {
  return prisma.event.findMany({
    skip,
    take,
    orderBy: { createdAt: "desc" },
  });
};

/** =========================
 * GET EVENT BY ID
 * ========================= */
const getEventById = async (id) => {
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
  const event = await prisma.event.findUnique({
    where: { id: Number(id) },
    include: {
      organizer: true,
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
 * UPDATE EVENT
 * ========================= */
const updateEvent = async (id, data, user) => {
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
  const event = await getEventById(id);

  if (event.organizerId !== user.id && user.role !== "ADMIN") {
    throw { status: 403, message: "Forbidden" };
  }

  return prisma.event.update({
    where: { id: Number(id) },
    data: { status: "PUBLISHED" },
  });
};

module.exports = {
  createEvent,
  listEvents,
  listAllEvents,
  getEventById,
  getEventWithSeatStatus,
  updateEvent,
  publishEvent,
};