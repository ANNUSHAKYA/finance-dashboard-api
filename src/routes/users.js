// src/routes/users.js
// User management — admin only for mutations.

const express = require("express");
const router = express.Router();
const { authenticate, requireRole } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { createUserSchema, updateUserSchema } = require("../utils/schemas");
const userService = require("../services/userService");

// All routes require authentication
router.use(authenticate);

/**
 * GET /users
 * Roles: admin
 * Query: ?page=1&limit=20&status=active
 */
router.get("/", requireRole("admin"), (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const status = ["active", "inactive"].includes(req.query.status) ? req.query.status : undefined;

  const result = userService.listUsers({ page, limit, status });
  res.json(result);
});

/**
 * POST /users
 * Roles: admin
 * Body: { name, email, password, role }
 */
router.post("/", requireRole("admin"), validate(createUserSchema), (req, res) => {
  const user = userService.createUser(req.body);
  res.status(201).json({ user });
});

/**
 * GET /users/:id
 * Roles: admin (can view any), others can view only themselves
 */
router.get("/:id", (req, res) => {
  const targetId = req.params.id;
  const isSelf = req.user.id === targetId;
  const isAdmin = req.user.role === "admin";

  if (!isSelf && !isAdmin) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const user = userService.getUserById(targetId);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user });
});

/**
 * PATCH /users/:id
 * Roles: admin only
 * Body: { name?, role?, status? }
 */
router.patch("/:id", requireRole("admin"), validate(updateUserSchema), (req, res) => {
  const user = userService.updateUser(req.params.id, req.body);
  res.json({ user });
});

module.exports = router;
