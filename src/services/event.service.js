/**
 * Event Service — Workflow 2 (Organizer Event Creation)
 * Handles: event CRUD, banner upload, publish workflow, seat management.
 */

const prisma = require("../lib/prisma");

/**
 * createEvent — Workflow 2 
 * Creates a new event in DRAFT status.
 * Validates: date must be future, seats >= 1, price not negative.
 * @param {object} data        - event fields from request body
 * @param {number} organizerId - organizer's user ID from JWT token
 * @returns {Promise<Event>} the newly created event record
 */
const createEvent = async (data, organizerId) => {
  // Validate eventDate is a real date
  const eventDate = new Date(data.eventDate);
  if (isNaN(eventDate.getTime())) {
    throw { status: 400, message: "eventDate must be a valid date" };
  }
  // Validate eventDate is in the future
  if (eventDate <= new Date()) {
    throw { status: 400, message: "Event date must be in the future" };
  }

  // Validate totalSeats is a whole number >= 1
  const seats = Number(data.totalSeats);
  if (!Number.isInteger(seats) || seats < 1) {
    throw { status: 400, message: "totalSeats must be a whole number of at least 1" };
  }

  // Validate ticketPrice is not negative (0 is fine — free event)
  const price = parseFloat(data.ticketPrice || 0);
  if (isNaN(price) || price < 0) {
    throw { status: 400, message: "ticketPrice cannot be negative" };
  }

  const isFree = price === 0;
  return prisma.event.create({
    data: {
      title:          data.title,
      description:    data.description || null,
      venue:          data.venue,
      eventDate,
      totalSeats:     seats,
      availableSeats: seats,
      ticketPrice:    price,
      isFree,
      status:         "DRAFT",
      organizerId,
    },
    include: { organizer: { select: { id: true, name: true, email: true } } },
  });
};

/** listEvents — returns published events ordered by date (soonest first).
 * @param {{ skip?: number, take?: number }} options
 * @returns {Promise<Event[]>} array of published events */

const listEvents = async ({ skip = 0, take = 50, status = "PUBLISHED" } = {}) => {
  return prisma.event.findMany({
    where: { status },
    skip,
    take,
    orderBy: { eventDate: "asc" },
    include: { organizer: { select: { id: true, name: true } } },
  });
};

/**
 * listAllEvents — admin-only: returns every event regardless of status.
 * Used by GET /api/events/admin/all.
 * @param {{ skip?: number, take?: number }} options
 */

const listAllEvents = async ({ skip = 0, take = 100 } = {}) => {
  return prisma.event.findMany({
    skip,
    take,
    orderBy: { createdAt: "desc" },
    include: { organizer: { select: { id: true, name: true } } },
  });
};

/** getEventById — fetches one event by ID. Throws 404 if not found.
 * @param {number} id - event ID from URL
 * @returns {Promise<Event>} the event with organizer info */

const getEventById = async (id) => {
  const event = await prisma.event.findUnique({
    where: { id },
    include: { organizer: { select: { id: true, name: true, email: true } } },
  });
  if (!event) throw { status: 404, message: "Event not found" };
  return event;
};

/** listEventsByOrganizer — returns all events for the logged-in organizer.
 * Used by the organizer dashboard GET /api/events/my.
 * @param {number} organizerId - from JWT token */

const listEventsByOrganizer = async (organizerId) => {
  return prisma.event.findMany({
    where: { organizerId },
    orderBy: { createdAt: "desc" },
  });
};

/** updateEvent — updates event fields. Only owner or admin allowed.
 * @param {number} id - event ID
 * @param {object} data - fields to update
 * @param {object} requestingUser - from JWT token */

const updateEvent = async (id, data, requestingUser) => {
  const event = await getEventById(id);
  if (event.organizerId !== requestingUser.id && requestingUser.role !== "ADMIN") {
    throw { status: 403, message: "Only the organizer can edit this event" };
  }

  const updateData = {};
  if (data.title !== undefined)       updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.venue !== undefined)       updateData.venue = data.venue;
  if (data.eventDate !== undefined)   updateData.eventDate = new Date(data.eventDate);
  if (data.status !== undefined)      updateData.status = data.status;
  if (data.ticketPrice !== undefined) {
    updateData.ticketPrice = parseFloat(data.ticketPrice);
    updateData.isFree = parseFloat(data.ticketPrice) === 0;
  }
  if (data.totalSeats !== undefined) {
    const seatsSold = event.totalSeats - event.availableSeats;
    const newAvailable = parseInt(data.totalSeats) - seatsSold;
    if (newAvailable < 0) {
      throw { status: 400, message: "Cannot reduce seats below tickets already issued" };
    }
    updateData.totalSeats = parseInt(data.totalSeats);
    updateData.availableSeats = newAvailable;
  }

  return prisma.event.update({ where: { id }, data: updateData });
};

/** publishEvent — sets event status to PUBLISHED so attendees can see it.
 * @param {number} id - event ID
 * @param {object} requestingUser - must be organizer or admin */

const publishEvent = async (id, requestingUser) => {
  const event = await getEventById(id);
  if (event.organizerId !== requestingUser.id && requestingUser.role !== "ADMIN") {
    throw { status: 403, message: "Not authorised" };
  }
  return prisma.event.update({ where: { id }, data: { status: "PUBLISHED" } });
};

/**
 * setBanner — attaches a banner image URL to an event (Workflow 2).
 * The URL is the path where Multer saved the uploaded file.
 * @param {number} id             - event ID
 * @param {string} bannerUrl      - full URL to the stored image file
 * @param {object} requestingUser - must be the event's organizer or admin
 */

const setBanner = async (id, bannerUrl, requestingUser) => {
  const event = await getEventById(id);
  if (event.organizerId !== requestingUser.id && requestingUser.role !== "ADMIN") {
    throw { status: 403, message: "Not authorised" };
  }
  return prisma.event.update({ where: { id }, data: { bannerUrl } });
};

/** deleteEvent — cancels an event (status → CANCELLED). Data preserved.
 * @param {number} id - event ID
 * @param {object} requestingUser - must be organizer or admin */

const deleteEvent = async (id, requestingUser) => {
  const event = await getEventById(id);
  if (event.organizerId !== requestingUser.id && requestingUser.role !== "ADMIN") {
    throw { status: 403, message: "Only the organizer can delete this event" };
  }
  await prisma.event.update({ where: { id }, data: { status: "CANCELLED" } });
  return { message: `Event '${event.title}' cancelled` };
};

/** searchEvents — filters published events by keyword, venue, date range.
 * All parameters optional. Supports pagination.
 * @param {{ search?, venue?, from?, to?, skip?, take? }} params */

const searchEvents = async ({ search, from, to, venue, skip = 0, take = 50 } = {}) => {
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

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      skip,
      take,
      orderBy: { eventDate: "asc" },
      include: {
        organizer: { select: { id: true, name: true } },
        _count: { select: { tickets: true } },
      },
    }),
    prisma.event.count({ where }),
  ]);

  return { events, total, skip, take };
};

/** getEventWithSeatStatus — returns event + live seat availability metrics.
 * Adds: seatsSold, seatsAvailable, isSoldOut to the response.
 * @param {number} id - event ID */

const getEventWithSeatStatus = async (id) => {
  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      organizer: { select: { id: true, name: true, email: true } },
      _count: { select: { tickets: true } },
    },
  });
  if (!event) throw { status: 404, message: "Event not found" };

  return {
    ...event,
    seatsSold:       event.totalSeats - event.availableSeats,
    seatsAvailable:  event.availableSeats,
    isSoldOut:       event.availableSeats === 0,
  };
};

module.exports = {
  createEvent, listEvents, listAllEvents, getEventById,
  listEventsByOrganizer, updateEvent, publishEvent, setBanner, deleteEvent,
  searchEvents, getEventWithSeatStatus,
};
