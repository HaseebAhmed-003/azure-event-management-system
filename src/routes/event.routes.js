

const express = require("express");
const router = express.Router();
const eventService = require("../services/event.service");
const { authenticate, requireOrganizer, requireAdmin } = require("../middleware/auth.middleware");
const upload = require("../middleware/upload.middleware");
const path = require("path");

/** GET /api/events - Public. Lists/searches all PUBLISHED events. */
router.get("/", async (req, res) => {
  try {
    const { search, from, to, venue } = req.query;
    const skip = parseInt(req.query.skip) || 0;
    const take = parseInt(req.query.take) || 50;

    if (search || from || to || venue) {
      const result = await eventService.searchEvents({ search, from, to, venue, skip, take });
      return res.json(result);
    }

    const events = await eventService.listEvents({ skip, take });
    res.json(events);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** GET /api/events/admin/all - Admin only. Lists all events regardless of status. */
router.get("/admin/all", authenticate, requireAdmin, async (req, res) => {
  try {
    const events = await eventService.listAllEvents({
      skip: parseInt(req.query.skip) || 0,
      take: parseInt(req.query.take) || 100,
    });
    res.json(events);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** GET /api/events/my - Organizer only. Returns their own events. */
router.get("/my", authenticate, requireOrganizer, async (req, res) => {
  try {
    const events = await eventService.listEventsByOrganizer(req.user.id);
    res.json(events);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** GET /api/events/:id/dashboard - Organizer only. Returns event stats. */
router.get("/:id/dashboard", authenticate, requireOrganizer, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    const event = await eventService.getEventById(eventId);

    if (event.organizerId !== req.user.id && req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Access denied — not your event" });
    }

    const prisma = require("../lib/prisma");
    const [totalBookings, confirmedBookings, totalRevenue, attendanceCount] = await Promise.all([
      prisma.booking.count({ where: { eventId } }),
      prisma.booking.count({ where: { eventId, status: "CONFIRMED" } }),
      prisma.payment.aggregate({
        where: { booking: { eventId }, status: "SUCCEEDED" },
        _sum: { amount: true },
      }),
      prisma.attendance.count({ where: { eventId, status: "PRESENT" } }),
    ]);

    res.json({
      event,
      stats: {
        totalBookings,
        confirmedBookings,
        totalRevenue:    parseFloat(totalRevenue._sum.amount || 0),
        ticketsSold:     event.totalSeats - event.availableSeats,
        seatsRemaining:  event.availableSeats,
        attendedCount:   attendanceCount,
        notYetArrived:   (event.totalSeats - event.availableSeats) - attendanceCount,
        fillRatePct:     event.totalSeats
          ? Math.round(((event.totalSeats - event.availableSeats) / event.totalSeats) * 100)
          : 0,
      },
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** GET /api/events/:id - Public. Returns one event by ID. */
router.get("/:id", async (req, res) => {
  try {
    const event = await eventService.getEventWithSeatStatus(parseInt(req.params.id));
    res.json(event);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** POST /api/events - Organizer only. Creates a new event in DRAFT. */
router.post("/", authenticate, requireOrganizer, async (req, res) => {
  try {
    const { title, description, venue, eventDate, totalSeats, ticketPrice } = req.body;
    if (!title || !venue || !eventDate || totalSeats === undefined || totalSeats === null || totalSeats === "") {
      return res.status(400).json({ error: "title, venue, eventDate and totalSeats are required" });
    }
    const event = await eventService.createEvent(req.body, req.user.id);
    res.status(201).json(event);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** PUT /api/events/:id - Organizer/Admin. Updates event fields. */
router.put("/:id", authenticate, requireOrganizer, async (req, res) => {
  try {
    const event = await eventService.updateEvent(parseInt(req.params.id), req.body, req.user);
    res.json(event);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** POST /api/events/:id/publish - Organizer/Admin. Makes event live. */
router.post("/:id/publish", authenticate, requireOrganizer, async (req, res) => {
  try {
    const event = await eventService.publishEvent(parseInt(req.params.id), req.user);
    res.json(event);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** POST /api/events/:id/banner - Organizer. Uploads banner image. */
router.post("/:id/banner", authenticate, requireOrganizer, upload.single("banner"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const bannerUrl = `${process.env.APP_BASE_URL}/uploads/banners/${req.file.filename}`;
    const event = await eventService.setBanner(parseInt(req.params.id), bannerUrl, req.user);
    res.json(event);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** DELETE /api/events/:id - Organizer/Admin. Cancels the event. */
router.delete("/:id", authenticate, requireOrganizer, async (req, res) => {
  try {
    const result = await eventService.deleteEvent(parseInt(req.params.id), req.user);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;