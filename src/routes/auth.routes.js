/**
 * Auth Routes — Group Member 1 (Fatima)
 *
 * POST   /api/auth/register       — create account (public)
 * POST   /api/auth/login          — get token (public)
 * GET    /api/auth/me             — get own profile (need token)
 * GET    /api/auth/users          — list all users (admin only)
 * GET    /api/auth/users/:id      — get one user (need token)
 * PUT    /api/auth/users/:id      — update user (own or admin)
 * DELETE /api/auth/users/:id      — deactivate user (admin only)
 */

const express = require("express");
const router = express.Router();
const authService = require("../services/auth.service");
const { authenticate, requireAdmin } = require("../middleware/auth.middleware");

router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "name, email and password are required" });
    }
    const result = await authService.register({ name, email, password, role });
    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }
    const result = await authService.login({ email, password });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get("/me", authenticate, (req, res) => {
  const { passwordHash, ...user } = req.user;
  res.json(user);
});

router.get("/users", authenticate, requireAdmin, async (req, res) => {
  try {
    const skip = parseInt(req.query.skip) || 0;
    const take = parseInt(req.query.take) || 50;
    const users = await authService.listUsers({ skip, take });
    res.json(users);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get("/users/:id", authenticate, async (req, res) => {
  try {
    const user = await authService.getUserById(parseInt(req.params.id));
    res.json(user);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.put("/users/:id", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (req.user.id !== id && req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Cannot update another user's profile" });
    }
    // Only name and email can be changed through this endpoint
    const { name, email } = req.body;
    const user = await authService.updateUser(id, { name, email });
    res.json(user);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.delete("/users/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await authService.deleteUser(parseInt(req.params.id));
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;