/**
 * Attendance Routes — Workflow 3 (QR Code Scanning & Attendance)
 *
 * POST   /api/attendance/scan                        [Organizer] — CORE WORKFLOW 3 ENDPOINT
 * GET    /api/attendance/event/:eventId              [Organizer] — confirmed attendees only
 * GET    /api/attendance/event/:eventId/all-scans    [Organizer] — fraud audit log
 * GET    /api/attendance/event/:eventId/summary      [Organizer] — real-time dashboard stats
 * GET    /api/attendance/:id                         [Organizer]
 * PUT    /api/attendance/:id                         [Organizer] — update notes
 * DELETE /api/attendance/:id                         [Admin]     — resets ticket to ACTIVE
 */

const express = require("express");
const router = express.Router();
const attendanceService = require("../services/attendance.service");
const { authenticate, requireOrganizer, requireAdmin } = require("../middleware/auth.middleware");

// ─── CORE SCAN ENDPOINT — Workflow 3  ───────────────────────────────
// Organizer calls this from their scanner with the QR code string.
// Full pipeline: retrieve → verify → block duplicates → mark PRESENT → update seats
router.post("/scan", authenticate, requireOrganizer, async (req, res) => {
  try {
    const { qrCode, scannedBy } = req.body;
    if (!qrCode) {
      return res.status(400).json({ error: "qrCode is required" });
    }
    // scannedBy defaults to the authenticated organizer's ID
    const result = await attendanceService.scanQrCode({
      qrCode,
      scannedBy: scannedBy || req.user.id,
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Confirmed attendees only (status = PRESENT)
router.get("/event/:eventId", authenticate, requireOrganizer, async (req, res) => {
  try {
    const records = await attendanceService.listConfirmedByEvent(parseInt(req.params.eventId));
    res.json(records);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// All scan attempts including duplicates and invalid — fraud audit log
router.get("/event/:eventId/all-scans", authenticate, requireOrganizer, async (req, res) => {
  try {
    const records = await attendanceService.listAllScansByEvent(parseInt(req.params.eventId));
    res.json(records);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Real-time attendance summary — seats, present count, duplicate attempts
router.get("/event/:eventId/summary", authenticate, requireOrganizer, async (req, res) => {
  try {
    const summary = await attendanceService.getEventSummary(parseInt(req.params.eventId));
    res.json(summary);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Get single attendance record
router.get("/:id", authenticate, requireOrganizer, async (req, res) => {
  try {
    const record = await attendanceService.getAttendanceById(parseInt(req.params.id));
    res.json(record);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Update notes on an attendance record
router.put("/:id", authenticate, requireOrganizer, async (req, res) => {
  try {
    const { notes } = req.body;
    const record = await attendanceService.updateAttendanceNotes(parseInt(req.params.id), notes);
    res.json(record);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Delete attendance record (Admin only) — resets linked ticket back to ACTIVE
router.delete("/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await attendanceService.deleteAttendanceRecord(parseInt(req.params.id));
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// GET /api/attendance/user/:userId — WF1: user's personal event history
// Attendees see their own history; organizers/admins can see anyone's
router.get("/user/:userId", authenticate, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (req.user.id !== userId && !["ORGANIZER", "ADMIN"].includes(req.user.role)) {
      return res.status(403).json({ error: "You can only view your own attendance history" });
    }
    const history = await attendanceService.getAttendanceByUser(userId);
    res.json(history);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
