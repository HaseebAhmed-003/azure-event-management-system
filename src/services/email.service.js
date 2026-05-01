// src/services/email.service.js
//
// Replaced Gmail SMTP (nodemailer) with Azure Communication Services Email.
// Also fixes the bug where `html` was undefined, causing silent email failures.
// Now generates a proper PDF ticket with embedded QR code and attaches it.
//
// Azure docs: https://learn.microsoft.com/azure/communication-services/quickstarts/email

const { EmailClient }  = require('@azure/communication-email');
const QRCode           = require('qrcode');
const PDFDocument      = require('pdfkit');

// ─── Azure Communication Services client ─────────────────────────────────────
// Initialised once and reused. Will be null if ACS is not configured.
let acsClient = null;

const getClient = () => {
  if (!acsClient) {
    if (!process.env.ACS_CONNECTION_STRING) return null;
    acsClient = new EmailClient(process.env.ACS_CONNECTION_STRING);
  }
  return acsClient;
};

// ─── PDF Ticket Generator ─────────────────────────────────────────────────────
// Generates a PDF buffer with one page per ticket.
// Each page contains: event info, attendee name, seat, booking ID, large QR code.
const generateTicketPDF = async (booking, tickets) => {
  return new Promise(async (resolve, reject) => {
    const doc    = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];

    doc.on('data',  c   => chunks.push(c));
    doc.on('end',   ()  => resolve(Buffer.concat(chunks)));
    doc.on('error', err => reject(err));

    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];

      // New page for each ticket after the first
      if (i > 0) doc.addPage();

      // ── Dark header band ──────────────────────────────────────────
      doc.rect(0, 0, doc.page.width, 80).fill('#1a1a2e');
      doc
        .fontSize(22).fillColor('#a78bfa')
        .text('EVENT TICKET', 50, 22);
      doc
        .fontSize(10).fillColor('#c4b5fd')
        .text(
          `Ticket ${i + 1} of ${tickets.length}  ·  Keep this — QR code required for entry`,
          50, 50
        );

      // ── Event title ───────────────────────────────────────────────
      doc.moveDown(2.5);
      doc
        .fontSize(20).fillColor('#111827')
        .text(booking.event?.title || 'Event', { align: 'center' });

      // ── Horizontal rule ───────────────────────────────────────────
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').lineWidth(1).stroke();
      doc.moveDown(0.8);

      // ── Details table ─────────────────────────────────────────────
      const rows = [
        ['Attendee',   booking.user?.name  || '—'],
        ['Date',       booking.event?.eventDate
          ? new Date(booking.event.eventDate).toLocaleDateString('en-US', {
              weekday: 'long', year: 'numeric', month: 'long',
              day: 'numeric', hour: '2-digit', minute: '2-digit',
            })
          : '—'],
        ['Venue',      booking.event?.venue || '—'],
        ['Seat',       ticket.seatNumber    || 'General Admission'],
        ['Ticket ID',  `#${ticket.id}`],
        ['Booking ID', `#${booking.id}`],
        ['Status',     ticket.status        || 'ACTIVE'],
      ];

      rows.forEach(([label, value], idx) => {
        const y = doc.y;
        // Alternating row background
        if (idx % 2 === 0) {
          doc.rect(50, y - 3, 495, 22).fillColor('#f9fafb').fill();
        }
        doc.fillColor('#6b7280').fontSize(11)
          .text(label, 60, y, { continued: true, width: 130 });
        doc.fillColor('#111827').fontSize(11)
          .text(value, { width: 355 });
        doc.moveDown(0.15);
      });

      // ── QR Code ───────────────────────────────────────────────────
      doc.moveDown(1.2);

      const qrBuffer = await QRCode.toBuffer(ticket.qrCode, {
        width:  200,
        margin: 2,
        color:  { dark: '#1a1a2e', light: '#ffffff' },
      });

      const qrX = (doc.page.width - 200) / 2;
      const qrY = doc.y;
      doc.image(qrBuffer, qrX, qrY, { width: 200, height: 200 });

      // Move cursor below the QR image
      doc.y = qrY + 210;

      doc.fontSize(10).fillColor('#6b7280')
        .text('Scan this QR code at the venue entrance', { align: 'center' });
      doc.fontSize(8).fillColor('#9ca3af')
        .text(ticket.qrCode, { align: 'center' });

      // ── Footer ────────────────────────────────────────────────────
      doc.moveDown(2);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').stroke();
      doc.moveDown(0.5);
      doc.fontSize(9).fillColor('#9ca3af')
        .text(
          'This ticket was generated automatically. One scan per entry. Do not share.',
          { align: 'center' }
        );
    }

    doc.end();
  });
};

// ─── Main email function ──────────────────────────────────────────────────────
// Called by payment.service.js after a payment succeeds (paid or free event).
// Sends a booking confirmation email with the PDF ticket attached.
const sendBookingConfirmation = async (toEmail, booking, tickets) => {
  const client = getClient();

  if (!client) {
    console.log('[EMAIL] ACS_CONNECTION_STRING not set — skipping email');
    return;
  }

  try {
    // 1. Generate PDF with all tickets for this booking
    const pdfBuffer  = await generateTicketPDF(booking, tickets);
    const pdfBase64  = pdfBuffer.toString('base64');
    const pdfName    = `tickets-booking-${booking.id}.pdf`;

    // 2. Build inline QR rows for the email body (small preview)
    let ticketRowsHtml = '';
    for (const t of tickets) {
      const qrDataUrl = await QRCode.toDataURL(t.qrCode, { width: 80 });
      ticketRowsHtml += `
        <tr>
          <td style="padding:10px 14px;border:1px solid #e5e7eb;font-size:13px">#${t.id}</td>
          <td style="padding:10px 14px;border:1px solid #e5e7eb;font-size:13px">${t.seatNumber || 'General Admission'}</td>
          <td style="padding:10px 14px;border:1px solid #e5e7eb">
            <img src="${qrDataUrl}" width="70" height="70" alt="QR code"/>
          </td>
        </tr>`;
    }

    // 3. Build email HTML body
    const htmlBody = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#111827">

        <div style="background:#1a1a2e;padding:28px 32px;border-radius:10px 10px 0 0">
          <h1 style="color:#a78bfa;margin:0;font-size:24px">Booking Confirmed 🎉</h1>
          <p style="color:#c4b5fd;margin:6px 0 0;font-size:14px">
            Your tickets for <strong>${booking.event?.title || 'the event'}</strong> are attached
          </p>
        </div>

        <div style="background:#f9fafb;padding:24px 32px">
          <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px">
            <tr>
              <td style="padding:8px 0;color:#6b7280;width:140px">Booking ID</td>
              <td style="padding:8px 0;font-weight:600">#${booking.id}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#6b7280">Event</td>
              <td style="padding:8px 0;font-weight:600">${booking.event?.title || '—'}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#6b7280">Date</td>
              <td style="padding:8px 0">
                ${booking.event?.eventDate
                  ? new Date(booking.event.eventDate).toLocaleDateString('en-US', {
                      weekday: 'long', year: 'numeric', month: 'long',
                      day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })
                  : '—'}
              </td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#6b7280">Venue</td>
              <td style="padding:8px 0">${booking.event?.venue || '—'}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#6b7280">Tickets</td>
              <td style="padding:8px 0">${tickets.length} ticket(s)</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#6b7280">Amount Paid</td>
              <td style="padding:8px 0;color:#059669;font-weight:700">
                ${parseFloat(booking.totalAmount) === 0
                  ? 'Free'
                  : `PKR ${parseFloat(booking.totalAmount).toLocaleString()}`}
              </td>
            </tr>
          </table>

          <div style="background:#ede9fe;border-left:4px solid #7c3aed;padding:14px 16px;border-radius:4px;margin-bottom:20px">
            <p style="margin:0;font-size:13px;color:#4c1d95">
              📎 <strong>Your PDF ticket is attached.</strong>
              Open it and show the QR code at the venue entrance. One scan per ticket.
            </p>
          </div>

          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="background:#e5e7eb">
                <th style="padding:10px 14px;border:1px solid #e5e7eb;text-align:left">Ticket ID</th>
                <th style="padding:10px 14px;border:1px solid #e5e7eb;text-align:left">Seat</th>
                <th style="padding:10px 14px;border:1px solid #e5e7eb;text-align:left">QR Preview</th>
              </tr>
            </thead>
            <tbody>${ticketRowsHtml}</tbody>
          </table>
        </div>

        <div style="background:#f3f4f6;padding:14px 32px;border-radius:0 0 10px 10px;text-align:center">
          <p style="margin:0;font-size:11px;color:#9ca3af">
            Sent via Azure Communication Services · Do not reply to this email
          </p>
        </div>

      </div>
    `;

    // 4. Send via Azure Communication Services
    const message = {
      senderAddress: process.env.ACS_SENDER,
      content: {
        subject: `🎟️ Your Tickets — ${booking.event?.title || 'Event'} (Booking #${booking.id})`,
        html:    htmlBody,
      },
      recipients: {
        to: [{ address: toEmail }],
      },
      attachments: [
        {
          name:           pdfName,
          contentType:    'application/pdf',
          contentInBase64: pdfBase64,
        },
      ],
    };

    // beginSend returns a poller — pollUntilDone waits for ACS to confirm delivery
    const poller = await client.beginSend(message);
    const result = await poller.pollUntilDone();

    console.log(`[EMAIL] ✅ Ticket PDF sent via ACS to ${toEmail} — message ID: ${result.id}`);

  } catch (err) {
    // Log but never throw — a failed email must never break the payment flow
    console.error('[EMAIL] ❌ ACS send failed (ignored so payment is unaffected):', err.message);
  }
};

module.exports = { sendBookingConfirmation };