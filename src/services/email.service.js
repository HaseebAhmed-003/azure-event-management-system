// src/services/email.service.js

const { EmailClient } = require("@azure/communication-email");
const QRCode = require("qrcode");
const PDFDocument = require("pdfkit");

// ─── Prisma FIX (THIS WAS THE REAL BUG CAUSE) ───────────────────────────────
// You were using prisma.$transaction in other files but never defined prisma
const { getPrisma } = require("../lib/prisma");
const prisma = getPrisma();

// ─── Azure Communication Services client ─────────────────────────────────────
let acsClient = null;

const getClient = () => {
  if (!acsClient) {
    if (!process.env.ACS_CONNECTION_STRING) return null;
    acsClient = new EmailClient(process.env.ACS_CONNECTION_STRING);
  }
  return acsClient;
};

// ─── PDF Generator ───────────────────────────────────────────────────────────
const generateTicketPDF = async (booking, tickets) => {
  return new Promise(async (resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks = [];

    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];

      if (i > 0) doc.addPage();

      doc.fontSize(20).text("EVENT TICKET", { align: "center" });
      doc.moveDown();

      doc
        .fontSize(14)
        .text(booking.event?.title || "Event", { align: "center" });

      doc.moveDown();

      const qrBuffer = await QRCode.toBuffer(ticket.qrCode, {
        width: 200,
        margin: 2,
      });

      doc.image(qrBuffer, { align: "center", width: 180 });
      doc.moveDown();

      doc
        .fontSize(10)
        .text(`Ticket ID: ${ticket.id}`, { align: "center" });
    }

    doc.end();
  });
};

// ─── EMAIL FUNCTION ─────────────────────────────────────────────────────────
const sendBookingConfirmation = async (toEmail, booking, tickets) => {
  const client = getClient();

  if (!client) {
    console.log("[EMAIL] ACS not configured — skipping email");
    return;
  }

  try {
    const pdfBuffer = await generateTicketPDF(booking, tickets);

    const message = {
      senderAddress: process.env.ACS_SENDER,
      content: {
        subject: `Your Tickets - ${booking.event?.title}`,
        html: `<p>Your tickets are attached.</p>`,
      },
      recipients: {
        to: [{ address: toEmail }],
      },
      attachments: [
        {
          name: `booking-${booking.id}.pdf`,
          contentType: "application/pdf",
          contentInBase64: pdfBuffer.toString("base64"),
        },
      ],
    };

    const poller = await client.beginSend(message);
    await poller.pollUntilDone();

    console.log("[EMAIL] Sent successfully");
  } catch (err) {
    console.error("[EMAIL] Failed:", err.message);
  }
};

module.exports = { sendBookingConfirmation };