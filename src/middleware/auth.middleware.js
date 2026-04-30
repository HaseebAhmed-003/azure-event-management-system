

const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Invalid or deactivated account" });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

const requireOrganizer = (req, res, next) => {
  if (!["ORGANIZER", "ADMIN"].includes(req.user.role)) {
    return res.status(403).json({ error: "Organizer or Admin role required" });
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Admin role required" });
  }
  next();
};

module.exports = { authenticate, requireOrganizer, requireAdmin };