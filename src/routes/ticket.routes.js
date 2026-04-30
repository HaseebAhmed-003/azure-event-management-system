

const express = require("express");
const router = express.Router();
const ticketService = require("../services/ticket.service");
const { authenticate, requireOrganizer } = require("../middleware/auth.middleware");

// My tickets — Workflow 
router.get("/my", authenticate, async (req, res) => {
  try {
    const tickets = await ticketService.listTicketsByUser(req.user.id);
    res.json(tickets);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Tickets for a booking
router.get("/booking/:bookingId", authenticate, async (req, res) => {
  try {
    const tickets = await ticketService.listTicketsByBooking(parseInt(req.params.bookingId));
    res.json(tickets);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// [Organizer] tickets for an event
router.get("/event/:eventId", authenticate, requireOrganizer, async (req, res) => {
  try {
    const tickets = await ticketService.listTicketsByEvent(parseInt(req.params.eventId));
    res.json(tickets);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Get QR code as base64 PNG image
router.get("/:id/qr", authenticate, async (req, res) => {
  try {
    const ticket = await ticketService.getTicketQRImage(parseInt(req.params.id));
    if (ticket.userId !== req.user.id && !["ORGANIZER", "ADMIN"].includes(req.user.role)) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(ticket);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Get single ticket
router.get("/:id", authenticate, async (req, res) => {
  try {
    const ticket = await ticketService.getTicketById(parseInt(req.params.id));
    if (ticket.userId !== req.user.id && !["ORGANIZER", "ADMIN"].includes(req.user.role)) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(ticket);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// [Organizer] update ticket seat number or status
router.put("/:id", authenticate, requireOrganizer, async (req, res) => {
  try {
    const ticket = await ticketService.updateTicket(parseInt(req.params.id), req.body);
    res.json(ticket);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Cancel a ticket — restores one seat to the event
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const ticket = await ticketService.getTicketById(parseInt(req.params.id));
    if (ticket.userId !== req.user.id && !["ORGANIZER", "ADMIN"].includes(req.user.role)) {
      return res.status(403).json({ error: "Access denied" });
    }
    const result = await ticketService.cancelTicket(parseInt(req.params.id));
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// GET /api/tickets/:id/qr/download — downloads QR as PNG file
router.get("/:id/qr/download", authenticate, async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id);
    const { buffer, ticket } = await ticketService.getTicketQRBuffer(ticketId);
    if (ticket.userId !== req.user.id && !["ORGANIZER", "ADMIN"].includes(req.user.role)) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.set("Content-Type", "image/png");
    res.set("Content-Disposition", `attachment; filename="ticket-${ticketId}-qr.png"`);
    res.set("Content-Length", buffer.length);
    res.send(buffer);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
