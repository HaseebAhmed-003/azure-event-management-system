/**
 * Ticket Service — Workflow 3 (QR Ticket Generation)
 * Handles: unique QR code generation per ticket, base64 image, ticket CRUD.
 */

const QRCode = require("qrcode");
const { v4: uuidv4 } = require("uuid");
const prisma = require("../lib/prisma");

// ── Helpers ─────────────────────────────────────────────────────────

const makeQrString = (ticketId, eventId, userId, bookingId) =>
  `TKT-${ticketId}-EVT-${eventId}-USR-${userId}-BKG-${bookingId}-${uuidv4()}`;

const qrToBase64 = async (data) => {
  return QRCode.toDataURL(data, { width: 300, margin: 2 });
};

// ── Service functions ────────────────────────────────────────────────

/**
 * Called internally after a payment succeeds.
 * Creates one ticket per quantity unit in the booking.
 */
const generateTicketsForBooking = async (booking) => {
  const tickets = [];

  // Count existing tickets for this event to continue seat numbering
  const existingTicketCount = await prisma.ticket.count({
    where: { eventId: booking.eventId },
  });

  for (let i = 0; i < booking.quantity; i++) {
    const seatNumber = `GEN-${existingTicketCount + i + 1}`;

    const ticket = await prisma.ticket.create({
      data: {
        qrCode: `PENDING-${uuidv4()}`,
        userId: booking.userId,
        eventId: booking.eventId,
        bookingId: booking.id,
        seatNumber,
      },
    });

    const qrCode = makeQrString(ticket.id, booking.eventId, booking.userId, booking.id);
    const updated = await prisma.ticket.update({
      where: { id: ticket.id },
      data: { qrCode },
      include: {
        event: { select: { title: true } },
        user: { select: { name: true, email: true } },
      },
    });

    tickets.push(updated);
  }

  return tickets;
};

const getTicketById = async (id) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      event: { select: { id: true, title: true, eventDate: true, venue: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });
  if (!ticket) throw { status: 404, message: "Ticket not found" };
  return ticket;
};

const getTicketQRImage = async (id) => {
  const ticket = await getTicketById(id);
  const qrImageBase64 = await qrToBase64(ticket.qrCode);
  return { ...ticket, qrImageBase64 };
};

const listTicketsByUser = async (userId) => {
  return prisma.ticket.findMany({
    where: { userId },
    include: { event: { select: { id: true, title: true, eventDate: true, venue: true } } },
    orderBy: { issuedAt: "desc" },
  });
};

const listTicketsByEvent = async (eventId) => {
  return prisma.ticket.findMany({
    where: { eventId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { issuedAt: "desc" },
  });
};

const listTicketsByBooking = async (bookingId) => {
  return prisma.ticket.findMany({ where: { bookingId } });
};

const updateTicket = async (id, data) => {
  return prisma.ticket.update({ where: { id }, data });
};

const cancelTicket = async (id) => {
  const ticket = await getTicketById(id);
  if (ticket.status === "CANCELLED") throw { status: 400, message: "Ticket already cancelled" };
  if (ticket.status === "USED")      throw { status: 400, message: "Cannot cancel a used ticket" };

  await prisma.$transaction([
    prisma.ticket.update({ where: { id }, data: { status: "CANCELLED" } }),
    prisma.event.update({
      where: { id: ticket.eventId },
      data: { availableSeats: { increment: 1 } },
    }),
  ]);

  return { message: `Ticket ${id} cancelled` };
};

/**
 * getTicketQRBuffer — Member 3 addition
 * Returns QR code as raw PNG binary buffer for file download.
 * Route: GET /api/tickets/:id/qr/download
 */
const getTicketQRBuffer = async (id) => {
  const ticket = await getTicketById(id);
  const buffer = await QRCode.toBuffer(ticket.qrCode, {
    width: 400,
    margin: 3,
    color: { dark: "#000000", light: "#ffffff" },
  });
  return { buffer, ticket };
};

module.exports = {
  generateTicketsForBooking, getTicketById, getTicketQRImage,
  listTicketsByUser, listTicketsByEvent, listTicketsByBooking,
  updateTicket, cancelTicket, getTicketQRBuffer,
};
