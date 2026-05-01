const jwt = require("jsonwebtoken");
const { getPrisma } = require("../lib/prisma");

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const prisma = getPrisma();

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    if (!user.isActive) {
      return res.status(401).json({ error: "Account deactivated" });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(500).json({ error: "Authentication failed" });
  }
};

const requireOrganizer = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });

  if (!["ORGANIZER", "ADMIN"].includes(req.user.role)) {
    return res.status(403).json({ error: "Organizer or Admin required" });
  }

  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });

  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Admin required" });
  }

  next();
};

module.exports = { authenticate, requireOrganizer, requireAdmin };