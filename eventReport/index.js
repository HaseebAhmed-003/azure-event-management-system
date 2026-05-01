const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");

// FIX: eventReport/ is at root level, so lib/prisma lives in ../src/lib/prisma
const { getPrisma } = require("../src/lib/prisma");

module.exports = async function (context, myTimer) {
  context.log("⏰ Event report triggered");

  const prisma = getPrisma();
  const now = new Date();

  try {
    const endedEvents = await prisma.event.findMany({
      where: {
        status: "PUBLISHED",
        eventDate: { lte: now },
      },
      include: {
        organizer: {
          select: { name: true, email: true },
        },
        bookings: {
          where: { status: "CONFIRMED" },
          include: {
            tickets: true,
          },
        },
        attendance: {
          where: { status: "PRESENT" },
        },
      },
    });

    context.log(`Found ${endedEvents.length} ended events`);

    for (const event of endedEvents) {
      try {
        const bookings   = event.bookings   || [];
        const attendance = event.attendance || [];

        const totalTicketsSold = bookings.reduce(
          (sum, b) => sum + (b.tickets?.length || 0),
          0
        );

        const totalRevenue = bookings.reduce(
          (sum, b) => sum + Number(b.totalAmount || 0),
          0
        );

        const totalAttended  = attendance.length;
        const noShows        = totalTicketsSold - totalAttended;
        const attendanceRate =
          totalTicketsSold > 0
            ? Math.round((totalAttended / totalTicketsSold) * 100)
            : 0;

        const stats = {
          totalTicketsSold,
          totalAttended,
          noShows,
          attendanceRate,
          totalRevenue,
        };

        const pdfBuffer = await generatePDF(event, stats);

        await sendEmail({
          to:         event.organizer.email,
          name:       event.organizer.name,
          eventTitle: event.title,
          pdfBuffer,
        });

        await prisma.event.update({
          where: { id: event.id },
          data:  { status: "COMPLETED" },
        });

        context.log(`✅ Report sent: ${event.title}`);
      } catch (err) {
        context.log("❌ Event processing failed:", err);
      }
    }
  } catch (err) {
    context.log("❌ Event report error:", err);
  }
  // Note: do NOT call prisma.$disconnect() in a serverless/timer function —
  // it tears down the connection pool and causes errors on the next invocation.
};

/* =================== PDF =================== */

function generatePDF(event, stats) {
  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ margin: 50 });
    const chunks = [];

    doc.on("data",  (c) => chunks.push(c));
    doc.on("end",   () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(20).text("Event Attendance Report", { align: "center" });
    doc.moveDown();

    doc.fontSize(14).text(event.title, { align: "center" });
    doc.fontSize(10).text(new Date(event.eventDate).toLocaleString(), {
      align: "center",
    });

    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown();

    const rows = [
      ["Tickets Sold",    stats.totalTicketsSold],
      ["Attended",        stats.totalAttended],
      ["No Shows",        stats.noShows],
      ["Attendance Rate", `${stats.attendanceRate}%`],
      ["Revenue",         `PKR ${stats.totalRevenue.toLocaleString()}`],
    ];

    rows.forEach(([label, value]) => {
      doc.fontSize(12).text(`${label}:`, { continued: true, width: 200 });
      doc.text(String(value), { align: "right" });
    });

    doc.end();
  });
}

/* =================== EMAIL =================== */

async function sendEmail({ to, name, eventTitle, pdfBuffer }) {
  const transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST || "smtp.gmail.com",
    port:   Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from:    process.env.EMAIL_FROM,
    to,
    subject: `Event Report — ${eventTitle}`,
    html:    `<p>Hi ${name},</p><p>Your event <strong>${eventTitle}</strong> has ended. Please find the attendance report attached.</p>`,
    attachments: [
      {
        filename: `${eventTitle.replace(/[^a-z0-9]/gi, "_")}_report.pdf`,
        content:  pdfBuffer,
      },
    ],
  });
}