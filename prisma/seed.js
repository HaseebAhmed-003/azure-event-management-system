const { getPrisma } = require("./src/lib/prisma");
const bcrypt = require("bcryptjs");

async function main() {
  console.log("🌱 Seeding database...");

  const prisma = getPrisma();

  try {
    const admin = await prisma.user.upsert({
      where: { email: "admin@eventsystem.com" },
      update: {},
      create: {
        name: "Admin User",
        email: "admin@eventsystem.com",
        passwordHash: await bcrypt.hash("admin123", 10),
        role: "ADMIN",
        isActive: true,
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
        isActive: true,
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
        isActive: true,
      },
    });

    const eventDate = new Date();
    eventDate.setHours(eventDate.getHours() - 2);

    await prisma.event.create({
      data: {
        title: "IBA Tech Fest 2026",
        description: "Annual tech festival",
        venue: "IBA Karachi",
        eventDate,
        totalSeats: 200,
        availableSeats: 200,
        ticketPrice: 500,
        isFree: false,
        status: "PUBLISHED",
        organizerId: organizer.id,
      },
    });

    console.log("✅ Seed complete");
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  });