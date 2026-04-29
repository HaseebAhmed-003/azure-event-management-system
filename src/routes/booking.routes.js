/**
 * Booking Routes — Workflow 2 
 * Handles booking creation, retrieval, and cancellation.
 */

/**
 * Booking Routes — Workflow 1 
 * POST   /api/bookings                     [Attendee]
 * GET    /api/bookings/my                  [Attendee]
 * GET    /api/bookings/admin/all           [Admin]
 * GET    /api/bookings/event/:eventId      [Organizer]
 * GET    /api/bookings/:id
 * PUT    /api/bookings/:id/status          [Admin]
 * DELETE /api/bookings/:id                 [Owner]
 */

const express = require("express");
const router = express.Router();
const bookingService = require("../services/booking.service");
const { authenticate, requireOrganizer, requireAdmin } = require("../middleware/auth.middleware");

// Create booking — reserves seats 
router.post("/", authenticate, async (req, res) => {
  try {
    const { eventId, quantity } = req.body;
    // Use explicit undefined/null check — !quantity would wrongly reject 0 as "missing"
    if (eventId === undefined || eventId === null || quantity === undefined || quantity === null || quantity === "") {
      return res.status(400).json({ error: "eventId and quantity are required" });
    }
    const booking = await bookingService.createBooking(
      // parseInt is correct for eventId (it's an ID from the URL/body, always a whole number)
      // quantity must NOT be parseInt — pass the raw value so the service can reject decimals
      { eventId: parseInt(eventId), quantity },
      req.user.id
    );
    res.status(201).json(booking);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// My bookings
router.get("/my", authenticate, async (req, res) => {
  try {
    const bookings = await bookingService.listBookingsByUser(req.user.id);
    res.json(bookings);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// [Admin] all bookings
router.get("/admin/all", authenticate, requireAdmin, async (req, res) => {
  try {
    const bookings = await bookingService.listAllBookings({
      skip: parseInt(req.query.skip) || 0,
      take: parseInt(req.query.take) || 100,
    });
    res.json(bookings);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// [Organizer] bookings for a specific event
router.get("/event/:eventId", authenticate, requireOrganizer, async (req, res) => {
  try {
    const bookings = await bookingService.listBookingsByEvent(parseInt(req.params.eventId));
    res.json(bookings);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Get single booking
router.get("/:id", authenticate, async (req, res) => {
  try {
    const booking = await bookingService.getBookingById(parseInt(req.params.id));
    if (booking.userId !== req.user.id && !["ORGANIZER", "ADMIN"].includes(req.user.role)) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(booking);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// [Admin] manually update booking status
router.put("/:id/status", authenticate, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: "status is required" });
    const booking = await bookingService.updateBookingStatus(parseInt(req.params.id), status);
    res.json(booking);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Cancel booking
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const result = await bookingService.cancelBooking(parseInt(req.params.id), req.user.id);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;