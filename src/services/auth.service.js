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

/** REGISTER */
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

/** LOGIN */
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

module.exports = { register, login };