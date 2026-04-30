

const nodemailer = require("nodemailer");
const QRCode = require("qrcode");

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

const buildTicketRows = async (tickets) => {
  let html = "";
  for (const ticket of tickets) {
    const qrDataUrl = await QRCode.toDataURL(ticket.qrCode, { width: 120 });
    html += `
      <tr>
        <td style="padding:10px;border:1px solid #e5e7eb;">${ticket.id}</td>
        <td style="padding:10px;border:1px solid #e5e7eb;">${ticket.seatNumber || "General Admission"}</td>
        <td style="padding:10px;border:1px solid #e5e7eb;">${ticket.status}</td>
        <td style="padding:10px;border:1px solid #e5e7eb;"><img src="${qrDataUrl}" width="100" height="100"/></td>
      </tr>`;
  }
  return html;
};

const sendBookingConfirmation = async (toEmail, booking, tickets) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log(`[EMAIL] SMTP not configured — skipping confirmation to ${toEmail}`);
    return;
  }

  try {
    const ticketRows = await buildTicketRows(tickets);
    const transporter = createTransporter();

    const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#333;">
      <div style="background:#4F46E5;padding:24px;border-radius:8px 8px 0 0;">
        <h1 style="color:#fff;margin:0;font-size:24px;">🎟 Booking Confirmed!</h1>
      </div>
      <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
        <p>Hi <strong>${booking.user?.name || "there"}</strong>! Your booking <strong>#${booking.id}</strong> is confirmed.</p>
        <p><strong>Event:</strong> ${booking.event?.title}</p>
        <p><strong>Venue:</strong> ${booking.event?.venue}</p>
        <p><strong>Total Paid:</strong> $${booking.totalAmount}</p>
        <br/>
        <table style="border-collapse:collapse;width:100%;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:10px;border:1px solid #e5e7eb;text-align:left;">Ticket ID</th>
              <th style="padding:10px;border:1px solid #e5e7eb;text-align:left;">Seat</th>
              <th style="padding:10px;border:1px solid #e5e7eb;text-align:left;">Status</th>
              <th style="padding:10px;border:1px solid #e5e7eb;text-align:left;">QR Code</th>
            </tr>
          </thead>
          <tbody>${ticketRows}</tbody>
        </table>
        <p style="margin-top:20px;color:#6b7280;font-size:12px;">
          Present your QR code at the venue. Each QR code is unique and single-use.
        </p>
      </div>
    </div>`;

    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: toEmail,
      subject: `Booking Confirmed #${booking.id} — Your Tickets`,
      html,
    });

    console.log(`[EMAIL] Confirmation sent to ${toEmail}`);
  } catch (err) {
    console.error(`[EMAIL] Failed to send to ${toEmail}:`, err.message);
  }
};

module.exports = { sendBookingConfirmation };
