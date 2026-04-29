/**
 * Review Service — Azure Cognitive Services Text Analytics
 * 
 * When a user submits a review, we send the text to Azure Text Analytics.
 * Azure AI returns: sentiment label (positive/neutral/negative) + confidence score.
 * We store both in the database so organizers can see how their events were received.
 */

const https   = require('https');
const prisma  = require('../lib/prisma');

/**
 * analyzeSentiment — calls Azure Cognitive Services Text Analytics API
 * Returns: { label: 'positive'|'neutral'|'negative', score: 0.0–1.0 }
 */
const analyzeSentiment = async (text) => {
  const endpoint = process.env.COGNITIVE_SERVICES_ENDPOINT;
  const apiKey   = process.env.COGNITIVE_SERVICES_KEY;

  if (!endpoint || !apiKey) {
    console.log('[SENTIMENT] Azure Cognitive Services not configured — skipping analysis');
    return { label: 'neutral', score: 0.5 };
  }

  const body = JSON.stringify({
    documents: [{ id: '1', language: 'en', text }],
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: endpoint.replace('https://', '').replace('/', ''),
      path:     '/text/analytics/v3.1/sentiment',
      method:   'POST',
      headers:  {
        'Content-Type':              'application/json',
        'Ocp-Apim-Subscription-Key': apiKey,
        'Content-Length':            Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed     = JSON.parse(data);
          const doc        = parsed.documents?.[0];
          const label      = doc?.sentiment || 'neutral';
          const scoreKey   = label === 'positive' ? 'positive'
                           : label === 'negative' ? 'negative'
                           : 'neutral';
          const score      = doc?.confidenceScores?.[scoreKey] || 0.5;
          resolve({ label, score: parseFloat(score.toFixed(3)) });
        } catch (e) {
          console.error('[SENTIMENT] Parse error:', e.message);
          resolve({ label: 'neutral', score: 0.5 });
        }
      });
    });

    req.on('error', (e) => {
      console.error('[SENTIMENT] Request error:', e.message);
      resolve({ label: 'neutral', score: 0.5 }); // fail gracefully
    });

    req.write(body);
    req.end();
  });
};

/** createReview — saves review + Azure sentiment to database */
const createReview = async ({ userId, eventId, reviewText }) => {
  // Check user actually has a confirmed booking for this event
  const booking = await prisma.booking.findFirst({
    where: { userId, eventId, status: 'CONFIRMED' },
  });
  if (!booking) {
    throw { status: 403, message: 'You can only review events you have a confirmed booking for' };
  }

  // Check not already reviewed
  const existing = await prisma.review.findFirst({ where: { userId, eventId } });
  if (existing) {
    throw { status: 400, message: 'You have already reviewed this event' };
  }

  // Analyze sentiment with Azure AI
  console.log(`[SENTIMENT] Analyzing review for event ${eventId}...`);
  const sentiment = await analyzeSentiment(reviewText);
  console.log(`[SENTIMENT] Result: ${sentiment.label} (${sentiment.score})`);

  const review = await prisma.review.create({
    data: {
      userId,
      eventId,
      reviewText,
      sentimentLabel: sentiment.label,
      sentimentScore: sentiment.score,
    },
    include: {
      user: { select: { id: true, name: true } },
    },
  });

  return review;
};

/** getReviewsForEvent — returns all reviews with sentiment for an event */
const getReviewsForEvent = async (eventId) => {
  const reviews = await prisma.review.findMany({
    where:   { eventId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  // Calculate aggregate sentiment summary
  const total     = reviews.length;
  const positive  = reviews.filter(r => r.sentimentLabel === 'positive').length;
  const neutral   = reviews.filter(r => r.sentimentLabel === 'neutral').length;
  const negative  = reviews.filter(r => r.sentimentLabel === 'negative').length;
  const avgScore  = total > 0
    ? parseFloat((reviews.reduce((s, r) => s + (r.sentimentScore || 0), 0) / total).toFixed(3))
    : null;

  return {
    summary: { total, positive, neutral, negative, avgScore },
    reviews,
  };
};

module.exports = { createReview, getReviewsForEvent };