// src/middleware/auth.js
// Verifies JWT from Authorization header and attaches user to req.
// Role guards are exported as simple middleware factories.

const jwt = require("jsonwebtoken");
const { getDb } = require("../db");

const JWT_SECRET = process.env.JWT_SECRET || "finance-dashboard-secret-key";

// Roles ordered by privilege level (higher index = more permissions)
const ROLE_LEVEL = { viewer: 0, analyst: 1, admin: 2 };

/**
 * Middleware: require a valid JWT.
 * Attaches decoded user to req.user.
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);

    // Confirm user still exists and is active
    const db = getDb();
    const user = db.prepare("SELECT id, name, email, role, status FROM users WHERE id = ?").get(payload.sub);
    if (!user || user.status !== "active") {
      return res.status(401).json({ error: "Account not found or deactivated" });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/**
 * Middleware factory: require the user to have AT LEAST the given role.
 * Usage: requireRole('analyst')
 */
function requireRole(minRole) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    if (ROLE_LEVEL[req.user.role] < ROLE_LEVEL[minRole]) {
      return res.status(403).json({
        error: `Forbidden: requires '${minRole}' role or higher`,
      });
    }
    next();
  };
}

function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "8h" });
}

module.exports = { authenticate, requireRole, signToken };
