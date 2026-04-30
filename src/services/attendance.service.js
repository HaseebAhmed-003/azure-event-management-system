

const prisma = require("../lib/prisma");

// ── Internal log helper ─────────────────────────────────────────────

const logScan = async (ticketId, eventId, scannedBy, status, notes) => {
  // For DUPLICATE and INVALID statuses,create a new row
  // and never touch the existing PRESENT record
  if (!ticketId || status === "DUPLICATE" || status === "INVALID") {
    return prisma.attendance.create({
      data: {
        ticketId: null,
        eventId,
        scannedBy,
        status,
        notes,
      },
    });
  }

  // Only upsert for PRESENT — the first valid scan
  return prisma.attendance.upsert({
    where: { ticketId },
    update: { status, notes, scannedBy, scanTime: new Date() },
    create: { ticketId, eventId, scannedBy, status, notes },
  });
};


// ── Core scan workflow ───────────────────────────────────────────────

const scanQrCode = async ({ qrCode, scannedBy }) => {
  const now = new Date();

  // Retrieve ticket by QR code string
  const ticket = await prisma.ticket.findUnique({
    where: { qrCode },
    include: { user: { select: { name: true } } },
  });

  if (!ticket) {
    await logScan(null, null, scannedBy, "INVALID", "QR code not found in system");
    return {
      success: false,
      status: "INVALID",
      message: "Invalid QR code — not found in system",
      scanTime: now,
    };
  }

  // Check for duplicate — already has a PRESENT attendance record
  const existing = await prisma.attendance.findFirst({
    where: { ticketId: ticket.id, status: "PRESENT" },
  });
  if (existing) {
    await logScan(ticket.id, ticket.eventId, scannedBy, "DUPLICATE", "Ticket already scanned");
    return {
      success: false,
      status: "DUPLICATE",
      message: "Duplicate entry blocked — this ticket has already been scanned",
      ticketId: ticket.id,
      eventId: ticket.eventId,
      attendeeName: ticket.user?.name,
      scanTime: now,
    };
  }

  // Validate ticket status
  if (ticket.status === "CANCELLED") {
    await logScan(ticket.id, ticket.eventId, scannedBy, "INVALID", "Cancelled ticket");
    return {
      success: false,
      status: "INVALID",
      message: "Ticket is cancelled and not valid for entry",
      ticketId: ticket.id,
      eventId: ticket.eventId,
      scanTime: now,
    };
  }
  if (ticket.status === "USED") {
    await logScan(ticket.id, ticket.eventId, scannedBy, "DUPLICATE", "Already-used ticket");
    return {
      success: false,
      status: "DUPLICATE",
      message: "Ticket has already been used",
      ticketId: ticket.id,
      eventId: ticket.eventId,
      scanTime: now,
    };
  }

  // Valid → mark USED, record attendance
  const [attendance] = await prisma.$transaction([
    prisma.attendance.create({
      data: {
        ticketId: ticket.id,
        eventId: ticket.eventId,
        scannedBy,
        status: "PRESENT",
        notes: "Entry granted",
      },
    }),
    prisma.ticket.update({ where: { id: ticket.id }, data: { status: "USED" } }),
  ]);

  return {
    success: true,
    status: "PRESENT",
    message: "Entry allowed — attendance marked successfully",
    ticketId: ticket.id,
    eventId: ticket.eventId,
    attendeeName: ticket.user?.name,
    seatNumber: ticket.seatNumber,
    scanTime: attendance.scanTime,
  };
};

// ── Read ─────────────────────────────────────────────────────────────

const getAttendanceById = async (id) => {
  const rec = await prisma.attendance.findUnique({
    where: { id },
    include: { ticket: true, scannedByUser: { select: { id: true, name: true } } },
  });
  if (!rec) throw { status: 404, message: "Attendance record not found" };
  return rec;
};

const listConfirmedByEvent = async (eventId) => {
  return prisma.attendance.findMany({
    where: { eventId, status: "PRESENT" },
    include: {
      ticket: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
    orderBy: { scanTime: "asc" },
  });
};

const listAllScansByEvent = async (eventId) => {
  return prisma.attendance.findMany({
    where: { eventId },
    include: { ticket: { select: { id: true, qrCode: true } } },
    orderBy: { scanTime: "desc" },
  });
};

const getEventSummary = async (eventId) => {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
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

// ── Update / Delete ───────────────────────────────────────────────────

const updateAttendanceNotes = async (id, notes) => {
  return prisma.attendance.update({ where: { id }, data: { notes } });
};

const deleteAttendanceRecord = async (id) => {
  const rec = await getAttendanceById(id);
  // If deleting a PRESENT record, reset ticket back to ACTIVE
  if (rec.status === "PRESENT" && rec.ticketId) {
    await prisma.ticket.update({ where: { id: rec.ticketId }, data: { status: "ACTIVE" } });
  }
  await prisma.attendance.delete({ where: { id } });
  return { message: `Attendance record ${id} deleted` };
};

module.exports = {
  scanQrCode, getAttendanceById, listConfirmedByEvent,
  listAllScansByEvent, getEventSummary, updateAttendanceNotes, deleteAttendanceRecord,
  getAttendanceByUser,
};

/**
 * getAttendanceByUser — addition after the email 
 * Returns all events a user has attended (PRESENT scans only).
 * Used by GET /api/attendance/user/:userId
 */
async function getAttendanceByUser(userId) {
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
      scanTime:     r.scanTime,
      event:        r.event,
      ticket:       r.ticket,
    })),
  };
}
