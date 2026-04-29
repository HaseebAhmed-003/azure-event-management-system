/**
 * Prisma Client Singleton — Group Member 1 (Fatima)
 *
 * Creates one shared database connection used by all service files.
 * Logging is enabled in development so we can see queries in the terminal.
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error"] : ["error"],
});

module.exports = prisma;