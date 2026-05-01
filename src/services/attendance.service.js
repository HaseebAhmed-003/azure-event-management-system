const { getPrisma } = require("../lib/prisma");

/** always get prisma inside functions */
const getDB = () => getPrisma();

// ─────────────────────────────────────────────
// LOG SCAN
// ─────────────────────────────────────────────
const logScan = async (ticketId, eventId, scannedBy, status, notes) => {
  const prisma = getDB();

  return prisma.attendance.create({
    data: {
      ticketId: ticketId || null,
      eventId: eventId || null,
      scannedBy,
      status,
      notes,
    },
  });
};

// ─────────────────────────────────────────────
// SCAN QR
// ─────────────────────────────────────────────
const scanQrCode = async ({ qrCode, scannedBy }) => {
  const prisma = getDB();
  const now = new Date();

  const ticket = await prisma.ticket.findUnique({
    where: { qrCode },
    include: { user: { select: { name: true } } },
  });

  if (!ticket) {
    await logScan(null, null, scannedBy, "INVALID", "QR not found");
    return {
      success: false,
      status: "INVALID",
      message: "Invalid QR code",
      scanTime: now,
    };
  }

  const existing = await prisma.attendance.findFirst({
    where: {
      ticketId: ticket.id,
      status: "PRESENT",
    },
  });

  if (existing) {
    await logScan(
      ticket.id,
      ticket.eventId,
      scannedBy,
      "DUPLICATE",
      "Already scanned"
    );

    return {
      success: false,
      status: "DUPLICATE",
      message: "Already scanned",
      ticketId: ticket.id,
      eventId: ticket.eventId,
      attendeeName: ticket.user?.name,
      scanTime: now,
    };
  }

  if (ticket.status === "CANCELLED") {
    await logScan(
      ticket.id,
      ticket.eventId,
      scannedBy,
      "INVALID",
      "Cancelled"
    );

    return {
      success: false,
      status: "INVALID",
      message: "Ticket cancelled",
    };
  }

  const attendance = await prisma.attendance.create({
    data: {
      ticketId: ticket.id,
      eventId: ticket.eventId,
      scannedBy,
      status: "PRESENT",
      notes: "Entry allowed",
    },
  });

  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { status: "USED" },
  });

  return {
    success: true,
    status: "PRESENT",
    message: "Entry allowed",
    ticketId: ticket.id,
    eventId: ticket.eventId,
    attendeeName: ticket.user?.name,
    scanTime: attendance.scanTime,
  };
};

// ─────────────────────────────────────────────
// READ FUNCTIONS
// ─────────────────────────────────────────────
const getAttendanceById = async (id) => {
  const prisma = getDB();

  const rec = await prisma.attendance.findUnique({
    where: { id },
    include: {
      ticket: true,
      scannedByUser: { select: { id: true, name: true } },
    },
  });

  if (!rec) throw { status: 404, message: "Not found" };
  return rec;
};

const listConfirmedByEvent = async (eventId) => {
  const prisma = getDB();

  return prisma.attendance.findMany({
    where: { eventId, status: "PRESENT" },
    include: {
      ticket: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
    orderBy: { scanTime: "asc" },
  });
};

const listAllScansByEvent = async (eventId) => {
  const prisma = getDB();

  return prisma.attendance.findMany({
    where: { eventId },
    include: {
      ticket: { select: { id: true, qrCode: true } },
    },
    orderBy: { scanTime: "desc" },
  });
};

const getEventSummary = async (eventId) => {
  const prisma = getDB();

  const event = await prisma.event.findUnique({
    where: { id: eventId },
  });

  if (!event) throw { status: 404, message: "Event not found" };

  const [total, present, duplicate, invalid] = await Promise.all([
    prisma.attendance.count({ where: { eventId } }),
    prisma.attendance.count({ where: { eventId, status: "PRESENT" } }),
    prisma.attendance.count({ where: { eventId, status: "DUPLICATE" } }),
    prisma.attendance.count({ where: { eventId, status: "INVALID" } }),
  ]);

  return {
    eventId,
    eventTitle: event.title,
    totalSeats: event.totalSeats,
    availableSeats: event.availableSeats,
    attended: present,
    totalScanAttempts: total,
    duplicateAttemptsBlocked: duplicate,
    invalidAttempts: invalid,
  };
};

// ─────────────────────────────────────────────
// USER ATTENDANCE
// ─────────────────────────────────────────────
const getAttendanceByUser = async (userId) => {
  const prisma = getDB();

  const records = await prisma.attendance.findMany({
    where: {
      status: "PRESENT",
      ticket: { userId },
    },
    include: {
      event: {
        select: { id: true, title: true, venue: true, eventDate: true },
      },
      ticket: {
        select: { id: true, seatNumber: true, qrCode: true },
      },
    },
    orderBy: { scanTime: "desc" },
  });

  return {
    userId,
    totalEventsAttended: records.length,
    history: records.map((r) => ({
      attendanceId: r.id,
      scanTime: r.scanTime,
      event: r.event,
      ticket: r.ticket,
    })),
  };
};

// ─────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────
module.exports = {
  scanQrCode,
  getAttendanceById,
  listConfirmedByEvent,
  listAllScansByEvent,
  getEventSummary,
  updateAttendanceNotes: async (id, notes) => {
    const prisma = getDB();
    return prisma.attendance.update({
      where: { id },
      data: { notes },
    });
  },
  deleteAttendanceRecord: async (id) => {
    const prisma = getDB();

    const rec = await prisma.attendance.findUnique({
      where: { id },
    });

    if (rec?.status === "PRESENT" && rec.ticketId) {
      await prisma.ticket.update({
        where: { id: rec.ticketId },
        data: { status: "ACTIVE" },
      });
    }

    await prisma.attendance.delete({
      where: { id },
    });

    return { message: "Deleted" };
  },
  getAttendanceByUser,
};