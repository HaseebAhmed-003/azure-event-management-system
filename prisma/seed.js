

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  const admin = await prisma.user.upsert({
    where: { email: "admin@eventsystem.com" },
    update: {},
    create: {
      name: "Admin User",
      email: "admin@eventsystem.com",
      passwordHash: await bcrypt.hash("admin123", 10),
      role: "ADMIN",
    },
  });

  const organizer = await prisma.user.upsert({
    where: { email: "organizer@eventsystem.com" },
    update: {},
    create: {
      name: "Event Organizer",
      email: "organizer@eventsystem.com",
      passwordHash: await bcrypt.hash("organizer123", 10),
      role: "ORGANIZER",
    },
  });

  const attendee = await prisma.user.upsert({
    where: { email: "attendee@eventsystem.com" },
    update: {},
    create: {
      name: "Test Attendee",
      email: "attendee@eventsystem.com",
      passwordHash: await bcrypt.hash("attendee123", 10),
      role: "ATTENDEE",
    },
  });

  await prisma.event.upsert({
    where: { id: 1 },
    update: {
      title: "IBA Tech Fest 2026",
      description: "Annual technology festival at IBA Karachi",
      venue: "IBA, Karachi",
      eventDate: new Date("2026-09-15T09:00:00Z"),
    },
    create: {
      title: "IBA Tech Fest 2026",
      description: "Annual technology festival at IBA Karachi",
      venue: "IBA, Karachi",
      eventDate: new Date("2026-09-15T09:00:00Z"),
      totalSeats: 200,
      availableSeats: 200,
      ticketPrice: 500.0,
      isFree: false,
      status: "PUBLISHED",
      organizerId: organizer.id,
    },
  });

  console.log("✅ Seed complete!");
  console.log("   admin@eventsystem.com     / admin123");
  console.log("   organizer@eventsystem.com / organizer123");
  console.log("   attendee@eventsystem.com  / attendee123");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());