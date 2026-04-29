/**
 * Auth Service — Group Member 1 (Fatima)
 * Handles: register, login, and user management
 *
 * register() — creates a new user, hashes password, returns token
 * login()    — checks email/password, returns token if correct
 * getUserById(), listUsers(), updateUser(), deleteUser() — user CRUD
 *
 * Passwords are NEVER returned in responses (safeUser removes it).
 * deleteUser() does soft-delete — marks user inactive, does not delete the row.
 */

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");

const signToken = (user) =>
  jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );

const safeUser = (user) => {
  const { passwordHash, ...rest } = user;
  return rest;
};

const register = async ({ name, email, password, role }) => {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw { status: 400, message: "Email already registered" };

  // Security: public registration can only create ATTENDEE or ORGANIZER accounts.
  // ADMIN accounts can only be created manually via the database or seed script.
  const allowedRoles = ["ATTENDEE", "ORGANIZER"];
  const assignedRole = allowedRoles.includes(role) ? role : "ATTENDEE";

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, role: assignedRole },
  });

  return { user: safeUser(user), token: signToken(user) };
};

const login = async ({ email, password }) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw { status: 401, message: "Invalid email or password" };
  }
  if (!user.isActive) throw { status: 403, message: "Account is deactivated" };

  return { user: safeUser(user), token: signToken(user) };
};

const getUserById = async (id) => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw { status: 404, message: "User not found" };
  return safeUser(user);
};

const listUsers = async ({ skip = 0, take = 50 } = {}) => {
  const users = await prisma.user.findMany({
    skip,
    take,
    orderBy: { createdAt: "desc" },
  });
  return users.map(safeUser);
};

const updateUser = async (id, data) => {
  // Security: only allow safe fields to be updated.
  // role, isActive, passwordHash are NOT allowed through this endpoint.
  const allowedFields = ["name", "email"];
  const safeData = {};

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      safeData[field] = data[field];
    }
  }

  if (Object.keys(safeData).length === 0) {
    throw { status: 400, message: "No valid fields provided. You can update: name, email" };
  }

  const user = await prisma.user.update({ where: { id }, data: safeData });
  return safeUser(user);
};

const deleteUser = async (id) => {
  // Check user exists first — gives a clean 404 instead of a raw Prisma error
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw { status: 404, message: `User ${id} not found` };

  await prisma.user.update({ where: { id }, data: { isActive: false } });
  return { message: `User ${id} deactivated successfully` };
};

module.exports = { register, login, getUserById, listUsers, updateUser, deleteUser };