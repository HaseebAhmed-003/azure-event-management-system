// scripts/seedSearch.js
// Run once: node scripts/seedSearch.js
require("dotenv").config();

const { loadSecretsFromKeyVault } = require("../src/lib/keyvault");
const { ensureIndexExists } = require("../src/lib/search");
const { indexEvent } = require("../src/services/search.service");

async function seed() {
  await loadSecretsFromKeyVault();

  process.env.DATABASE_URL =
    `postgresql://${process.env.DB_USER}:` +
    `${encodeURIComponent(process.env.DB_PASSWORD)}` +
    `@${process.env.DB_HOST}:5432/${process.env.DB_NAME}?sslmode=require`;

  const { getPrisma } = require("../src/lib/prisma");
  const prisma = getPrisma();

  await ensureIndexExists();

  const events = await prisma.event.findMany({
    where: { status: "PUBLISHED" },
    include: { organizer: { select: { name: true } } },
  });

  console.log(`Found ${events.length} published events to index`);

  for (const event of events) {
    await indexEvent(event);
  }

  console.log("✅ All events indexed");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});