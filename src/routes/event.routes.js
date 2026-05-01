const express = require("express");
const router = express.Router();

const eventService = require("../services/event.service");
const {
  authenticate,
  requireOrganizer,
  requireAdmin,
} = require("../middleware/auth.middleware");

const upload = require("../middleware/upload.middleware");

/** =========================
 * GET /events (public)
 * ========================= */
router.get("/", async (req, res) => {
  try {
    const { search, from, to, venue } = req.query;
    const skip = Number(req.query.skip) || 0;
    const take = Number(req.query.take) || 50;

    if (search || from || to || venue) {
      const result = await eventService.searchEvents({
        search,
        from,
        to,
        venue,
        skip,
        take,
      });
      return res.json(result);
    }

    const events = await eventService.listEvents({ skip, take });
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message || "Server error" });
  }
});

/** =========================
 * ADMIN - ALL EVENTS
 * ========================= */
router.get("/admin/all", authenticate, requireAdmin, async (req, res) => {
  try {
    const events = await eventService.listAllEvents({
      skip: Number(req.query.skip) || 0,
      take: Number(req.query.take) || 100,
    });

    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message || "Server error" });
  }
});

/** =========================
 * ORGANIZER EVENTS
 * ========================= */
router.get("/my", authenticate, requireOrganizer, async (req, res) => {
  try {
    const events = await eventService.listEventsByOrganizer(req.user.id);
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message || "Server error" });
  }
});

/** =========================
 * GET BY ID
 * (FIXED: uses correct service function)
 * ========================= */
router.get("/:id", async (req, res) => {
  try {
    const event = await eventService.getEventWithSeatStatus(
      Number(req.params.id)
    );

    res.json(event);
  } catch (err) {
    res.status(err.status || 500).json({
      error: err.message || "Event not found",
    });
  }
});

/** =========================
 * DASHBOARD (NO direct prisma usage here)
 * ========================= */
router.get(
  "/:id/dashboard",
  authenticate,
  requireOrganizer,
  async (req, res) => {
    try {
      const eventId = Number(req.params.id);

      const event = await eventService.getEventById(eventId);

      if (
        event.organizerId !== req.user.id &&
        req.user.role !== "ADMIN"
      ) {
        return res.status(403).json({ error: "Access denied" });
      }

      const dashboard = await eventService.getEventDashboard
        ? await eventService.getEventDashboard(eventId)
        : { event };

      res.json(dashboard);
    } catch (err) {
      res.status(500).json({ error: err.message || "Server error" });
    }
  }
);

/** =========================
 * CREATE
 * ========================= */
router.post("/", authenticate, requireOrganizer, async (req, res) => {
  try {
    const event = await eventService.createEvent(req.body, req.user.id);
    res.status(201).json(event);
  } catch (err) {
    res.status(500).json({ error: err.message || "Server error" });
  }
});

/** =========================
 * UPDATE
 * ========================= */
router.put("/:id", authenticate, requireOrganizer, async (req, res) => {
  try {
    const event = await eventService.updateEvent(
      Number(req.params.id),
      req.body,
      req.user
    );

    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message || "Server error" });
  }
});

/** =========================
 * PUBLISH
 * ========================= */
router.post("/:id/publish", authenticate, requireOrganizer, async (req, res) => {
  try {
    const event = await eventService.publishEvent(
      Number(req.params.id),
      req.user
    );

    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message || "Server error" });
  }
});

/** =========================
 * BANNER UPLOAD
 * ========================= */
router.post(
  "/:id/banner",
  authenticate,
  requireOrganizer,
  upload.single("banner"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const bannerUrl = `${process.env.APP_BASE_URL}/uploads/banners/${req.file.filename}`;

      const event = await eventService.setBanner(
        Number(req.params.id),
        bannerUrl,
        req.user
      );

      res.json(event);
    } catch (err) {
      res.status(500).json({ error: err.message || "Server error" });
    }
  }
);

/** =========================
 * DELETE
 * ========================= */
router.delete("/:id", authenticate, requireOrganizer, async (req, res) => {
  try {
    const result = await eventService.deleteEvent(
      Number(req.params.id),
      req.user
    );

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || "Server error" });
  }
});

module.exports = router;