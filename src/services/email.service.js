/**
 * Email Service — Azure Logic Apps Integration
 * 
 * Instead of sending emails directly via SMTP (nodemailer),
 * we call an Azure Logic Apps HTTP trigger which handles the email.
 * 
 * This is the cloud automation pattern — Logic Apps runs in Azure,
 * we just send it the data and it does the rest.
 */

const https = require('https');
const url = require('url');
const QRCode = require('qrcode');

/**
 * Calls the Azure Logic Apps HTTP trigger to send a booking confirmation email.
 * If LOGIC_APPS_URL is not set, falls back to console log (local dev mode).
 */
const sendBookingConfirmation = async (toEmail, booking, tickets) => {
  // Build QR code data URLs for all tickets
  const ticketsWithQR = [];
  for (const ticket of tickets) {
    const qrDataUrl = await QRCode.toDataURL(ticket.qrCode, { width: 150 });
    ticketsWithQR.push({
      ticketId:   ticket.id,
      seatNumber: ticket.seatNumber || 'General Admission',
      status:     ticket.status,
      qrCode:     ticket.qrCode,
      qrDataUrl,
    });
  }

  const payload = {
    toEmail,
    userName:      booking.user?.name || 'Guest',
    bookingId:     booking.id,
    eventTitle:    booking.event?.title || 'Event',
    eventVenue:    booking.event?.venue || '',
    eventDate:     booking.event?.eventDate
                     ? new Date(booking.event.eventDate).toLocaleDateString('en-AE', {
                         weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                       })
                     : '',
    totalAmount:   parseFloat(booking.totalAmount).toFixed(2),
    ticketCount:   tickets.length,
    tickets:       ticketsWithQR,
    generatedAt:   new Date().toISOString(),
  };

  const logicAppsUrl = process.env.LOGIC_APPS_URL;

  if (!logicAppsUrl) {
    // Local development — just log to console
    console.log(`[EMAIL] LOGIC_APPS_URL not set. Would send to: ${toEmail}`);
    console.log(`[EMAIL] Booking #${booking.id} confirmed, ${tickets.length} ticket(s) generated`);
    return;
  }

  try {
    await httpPost(logicAppsUrl, payload);
    console.log(`[EMAIL] Logic Apps triggered successfully for ${toEmail}`);
  } catch (err) {
    // Never crash the payment flow if email fails
    console.error(`[EMAIL] Logic Apps call failed for ${toEmail}: ${err.message}`);
  }
};

/** Simple HTTP POST helper — no extra dependencies needed */
const httpPost = (targetUrl, body) => {
  return new Promise((resolve, reject) => {
    const parsed   = url.parse(targetUrl);
    const data     = JSON.stringify(body);
    const options  = {
      hostname: parsed.hostname,
      path:     parsed.path,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(responseData);
        } else {
          reject(new Error(`Logic Apps returned HTTP ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
};

module.exports = { sendBookingConfirmation };