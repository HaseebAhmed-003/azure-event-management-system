

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
    console.log(`[EMAIL] SMTP not configured — skipping`);
    return;
  }

  try {
    const ticketRows = await buildTicketRows(tickets);
    const transporter = createTransporter();

    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: toEmail,
      subject: `Booking Confirmed #${booking.id}`,
      html,
    });

    console.log(`[EMAIL] Sent to ${toEmail}`);
  } catch (err) {
    console.log(`[EMAIL ERROR IGNORED]`, err.message);
    // IMPORTANT: do NOT throw error
  }
};

module.exports = { sendBookingConfirmation };
