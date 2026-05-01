const { PrismaClient } = require("@prisma/client");

let prisma;

/**
 * Prisma is created ONLY after DATABASE_URL exists
 * (Key Vault must run first in index.js)
 */
const getPrisma = () => {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL not set. Key Vault must be loaded before using Prisma."
    );
  }

  if (!prisma) {
    prisma = new PrismaClient();
  }

  return prisma;
};

module.exports = { getPrisma };