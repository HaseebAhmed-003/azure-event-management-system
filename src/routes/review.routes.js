/**
 * Review Routes — Azure Cognitive Services Integration
 * POST   /api/reviews            [Attendee] — submit review, auto-analyzed by Azure AI
 * GET    /api/reviews/event/:id  [Public]   — get reviews + sentiment for an event
 */

const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const reviewService    = require('../services/review.service');

// Submit a review for an event you attended
router.post('/', authenticate, async (req, res) => {
  try {
    const { eventId, reviewText } = req.body;
    if (!eventId || !reviewText || reviewText.trim().length < 5) {
      return res.status(400).json({ error: 'eventId and reviewText (min 5 chars) are required' });
    }
    const review = await reviewService.createReview({
      userId:     req.user.id,
      eventId:    parseInt(eventId),
      reviewText: reviewText.trim(),
    });
    res.status(201).json(review);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Get all reviews + sentiment for an event
router.get('/event/:id', async (req, res) => {
  try {
    const reviews = await reviewService.getReviewsForEvent(parseInt(req.params.id));
    res.json(reviews);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;