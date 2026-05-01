const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getPrisma } = require("../lib/prisma");

const signToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET not set");
  }

  return jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
};

const safeUser = (user) => {
  const { passwordHash, ...rest } = user;
  return rest;
};

/** =========================
 * REGISTER
 * ========================= */
const register = async ({ name, email, password, role }) => {
  const prisma = getPrisma();

  if (!name || !email || !password) {
    throw { status: 400, message: "Missing required fields" };
  }

  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    throw { status: 400, message: "Email already registered" };
  }

  const allowedRoles = ["ATTENDEE", "ORGANIZER"];
  const assignedRole = allowedRoles.includes(role) ? role : "ATTENDEE";

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: assignedRole,
      isActive: true,
    },
  });

  return {
    user: safeUser(user),
    token: signToken(user),
  };
};

/** =========================
 * LOGIN
 * ========================= */
const login = async ({ email, password }) => {
  const prisma = getPrisma();

  if (!email || !password) {
    throw { status: 400, message: "Missing email or password" };
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw { status: 401, message: "Invalid email or password" };
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash);

  if (!passwordValid) {
    throw { status: 401, message: "Invalid email or password" };
  }

  if (!user.isActive) {
    throw { status: 403, message: "Account is deactivated" };
  }

  return {
    user: safeUser(user),
    token: signToken(user),
  };
};

/** =========================
 * LIST USERS (ADMIN)
 * ========================= */
const listUsers = async ({ skip = 0, take = 50 } = {}) => {
  const prisma = getPrisma();

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      skip,
      take,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { bookings: true, organizedEvents: true },
        },
      },
    }),
    prisma.user.count(),
  ]);

  return { users, total, skip, take };
};

/** =========================
 * GET USER BY ID
 * ========================= */
const getUserById = async (id) => {
  const prisma = getPrisma();

  const user = await prisma.user.findUnique({
    where: { id: Number(id) },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: { bookings: true, organizedEvents: true, tickets: true },
      },
    },
  });

  if (!user) {
    throw { status: 404, message: "User not found" };
  }

  return user;
};

/** =========================
 * UPDATE USER
 * Only name and email can be changed here.
 * Password changes require a separate endpoint (not implemented).
 * ========================= */
const updateUser = async (id, { name, email }) => {
  const prisma = getPrisma();

  const user = await prisma.user.findUnique({
    where: { id: Number(id) },
  });

  if (!user) {
    throw { status: 404, message: "User not found" };
  }

  // If email is changing, make sure it is not already taken
  if (email && email !== user.email) {
    const taken = await prisma.user.findUnique({ where: { email } });
    if (taken) {
      throw { status: 400, message: "Email already in use" };
    }
  }

  const updated = await prisma.user.update({
    where: { id: Number(id) },
    data: {
      ...(name  && { name }),
      ...(email && { email }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return updated;
};

/** =========================
 * DELETE USER (ADMIN)
 * Soft-deletes by setting isActive = false.
 * Hard-delete is intentionally avoided — bookings/tickets reference the user.
 * ========================= */
const deleteUser = async (id) => {
  const prisma = getPrisma();

  const user = await prisma.user.findUnique({
    where: { id: Number(id) },
  });

  if (!user) {
    throw { status: 404, message: "User not found" };
  }

  await prisma.user.update({
    where: { id: Number(id) },
    data: { isActive: false },
  });

  return { message: `User ${id} deactivated` };
};

module.exports = {
  register,
  login,
  listUsers,
  getUserById,
  updateUser,
  deleteUser,
};