const { EmailClient } = require("@azure/communication-email");
const QRCode = require("qrcode");
const PDFDocument = require("pdfkit");

// ─── ACS Client (lazy — created only after vault secrets load) ────────────────
let acsClient = null;

const getClient = () => {
  if (!acsClient) {
    if (!process.env.ACS_CONNECTION_STRING) {
      console.warn("[EMAIL] ACS_CONNECTION_STRING not set — email disabled");
      return null;
    }
    acsClient = new EmailClient(process.env.ACS_CONNECTION_STRING);
  }
  return acsClient;
};

// ─── PDF Generator ────────────────────────────────────────────────────────────
const generateTicketPDF = async (booking, tickets) => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const chunks = [];

      doc.on("data",  (c) => chunks.push(c));
      doc.on("end",   () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i];

        if (i > 0) doc.addPage();

        // ── Header ──
        doc
          .fontSize(22)
          .font("Helvetica-Bold")
          .text("EVENT TICKET", { align: "center" });

        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).lineWidth(1).stroke();
        doc.moveDown(0.5);

        // ── Event info ──
        doc
          .fontSize(16)
          .font("Helvetica-Bold")
          .text(booking.event?.title || "Event", { align: "center" });

        doc.moveDown(0.3);

        if (booking.event?.eventDate) {
          doc
            .fontSize(11)
            .font("Helvetica")
            .fillColor("#555555")
            .text(
              `Date: ${new Date(booking.event.eventDate).toLocaleString("en-PK", {
                dateStyle: "full",
                timeStyle: "short",
              })}`,
              { align: "center" }
            );
        }

        if (booking.event?.venue) {
          doc
            .fontSize(11)
            .font("Helvetica")
            .text(`Venue: ${booking.event.venue}`, { align: "center" });
        }

        doc.fillColor("#000000").moveDown(0.8);

        // ── QR code (moved to bottom) ──
        const qrBuffer = await QRCode.toBuffer(ticket.qrCode, {
          width: 220,
          margin: 2,
          errorCorrectionLevel: "H",
        });

        const pageHeight = doc.page.height;
        const bottomMargin = 80;
        const qrY = pageHeight - bottomMargin - 220;

        const pageWidth = doc.page.width - 100;
        const qrX = (pageWidth - 220) / 2 + 50;

        doc.image(qrBuffer, qrX, qrY, { width: 220 });

        // ── Ticket details ──
        const details = [
          ["Ticket ID",   String(ticket.id)],
          ["Booking ID",  String(booking.id)],
          ["Seat",        ticket.seatNumber || "General Admission"],
          ["Attendee",    booking.user?.name  || "—"],
          ["Email",       booking.user?.email || "—"],
          ["Quantity",    `${booking.quantity} ticket(s)`],
        ];

        details.forEach(([label, value]) => {
          doc
            .fontSize(11)
            .font("Helvetica-Bold")
            .text(`${label}: `, { continued: true })
            .font("Helvetica")
            .text(value);
        });

        doc.moveDown(0.5);

        // ── Footer ──
        doc
          .fontSize(8)
          .fillColor("#888888")
          .text(
            "Present this QR code at the venue entrance. Each ticket is valid for one scan only.",
            { align: "center" }
          );

        doc.fillColor("#000000");
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

// ─── Send booking confirmation email ─────────────────────────────────────────
const sendBookingConfirmation = async (toEmail, booking, tickets) => {
  const client = getClient();

  if (!client) {
    console.log("[EMAIL] Skipping — ACS client not available");
    return;
  }

  const senderAddress = process.env.EMAIL_FROM;

  if (!senderAddress) {
    console.error(
      "[EMAIL] EMAIL_FROM is not set. " +
      "Make sure the 'EMAIL-FROM' secret exists in Azure Key Vault " +
      "(event-kv-iba) and matches a verified sender in your ACS email domain."
    );
    return;
  }

  try {
    console.log(`[EMAIL] Generating PDF for booking ${booking.id}...`);
    const pdfBuffer = await generateTicketPDF(booking, tickets);

    const eventTitle = booking.event?.title || "Event";
    const ticketWord = tickets.length === 1 ? "ticket" : "tickets";

    const message = {
      senderAddress,
      content: {
        subject: `Your ${ticketWord} for ${eventTitle}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2c3e50;">Booking Confirmed!</h2>
            <p>Hi <strong>${booking.user?.name || "there"}</strong>,</p>
            <p>
              Your booking for <strong>${eventTitle}</strong> is confirmed.
              Your ${ticketWord} ${tickets.length === 1 ? "is" : "are"} attached as a PDF.
            </p>
            <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
              <tr style="background: #f8f9fa;">
                <td style="padding: 8px 12px; font-weight: bold;">Event</td>
                <td style="padding: 8px 12px;">${eventTitle}</td>
              </tr>
              ${booking.event?.eventDate ? `
              <tr>
                <td style="padding: 8px 12px; font-weight: bold;">Date</td>
                <td style="padding: 8px 12px;">${new Date(booking.event.eventDate).toLocaleString()}</td>
              </tr>` : ""}
              ${booking.event?.venue ? `
              <tr style="background: #f8f9fa;">
                <td style="padding: 8px 12px; font-weight: bold;">Venue</td>
                <td style="padding: 8px 12px;">${booking.event.venue}</td>
              </tr>` : ""}
              <tr>
                <td style="padding: 8px 12px; font-weight: bold;">Booking ID</td>
                <td style="padding: 8px 12px;">${booking.id}</td>
              </tr>
              <tr style="background: #f8f9fa;">
                <td style="padding: 8px 12px; font-weight: bold;">Tickets</td>
                <td style="padding: 8px 12px;">${tickets.length}</td>
              </tr>
              <tr>
                <td style="padding: 8px 12px; font-weight: bold;">Amount Paid</td>
                <td style="padding: 8px 12px;">PKR ${Number(booking.totalAmount).toLocaleString()}</td>
              </tr>
            </table>
            <p style="color: #555;">
              Please present the QR code(s) in the attached PDF at the venue entrance.
              Each QR code is valid for one scan only.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
            <p style="font-size: 12px; color: #999;">
              This is an automated email. Please do not reply.
            </p>
          </div>
        `,
        plainText: `Hi ${booking.user?.name || "there"}, your booking for ${eventTitle} is confirmed. Booking ID: ${booking.id}. Tickets: ${tickets.length}. Please present the QR code(s) at the venue.`,
      },
      recipients: {
        to: [
          {
            address:     toEmail,
            displayName: booking.user?.name || toEmail,
          },
        ],
      },
      attachments: [
        {
          name:            `tickets-booking-${booking.id}.pdf`,
          contentType:     "application/pdf",
          contentInBase64: pdfBuffer.toString("base64"),
        },
      ],
    };

    console.log(`[EMAIL] Sending to ${toEmail}...`);
    const poller = await client.beginSend(message);
    const result = await poller.pollUntilDone();
    console.log(`[EMAIL] Sent successfully — messageId: ${result?.id}`);
  } catch (err) {
    console.error("[EMAIL] Failed:", err.message);
  }
};

module.exports = { sendBookingConfirmation };