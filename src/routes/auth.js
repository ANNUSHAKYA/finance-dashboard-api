// src/routes/auth.js
// POST /auth/login  — returns a JWT
// POST /auth/me     — returns the authenticated user

const express = require("express");
const router = express.Router();
const { validate } = require("../middleware/validate");
const { authenticate, signToken } = require("../middleware/auth");
const { verifyCredentials } = require("../services/userService");
const { loginSchema } = require("../utils/schemas");

/**
 * POST /auth/login
 * Body: { email, password }
 * Returns: { token, user }
 */
router.post("/login", validate(loginSchema), (req, res) => {
  const { email, password } = req.body;
  const user = verifyCredentials(email, password);

  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = signToken(user.id);
  res.json({ token, user });
});

/**
 * GET /auth/me
 * Returns the currently authenticated user.
 */
router.get("/me", authenticate, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
