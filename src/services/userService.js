// src/services/userService.js
// All user-related database operations live here.
// Routes stay thin; logic stays here.

const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { getDb } = require("../db");

const SALT_ROUNDS = 10;

// Strip password before returning user to caller
function safeUser(user) {
  if (!user) return null;
  const { password, ...rest } = user;
  return rest;
}

function createUser({ name, email, password, role }) {
  const db = getDb();

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    const err = new Error("Email already registered");
    err.status = 409;
    throw err;
  }

  const hashed = bcrypt.hashSync(password, SALT_ROUNDS);
  const id = uuidv4();

  db.prepare(`
    INSERT INTO users (id, name, email, password, role)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, name, email, hashed, role);

  return safeUser(db.prepare("SELECT * FROM users WHERE id = ?").get(id));
}

function listUsers({ page = 1, limit = 20, status } = {}) {
  const db = getDb();
  const offset = (page - 1) * limit;

  let where = "";
  const params = [];
  if (status) {
    where = "WHERE status = ?";
    params.push(status);
  }

  const total = db.prepare(`SELECT COUNT(*) as n FROM users ${where}`).get(...params).n;
  const rows = db
    .prepare(`SELECT id, name, email, role, status, created_at FROM users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset);

  return { total, page, limit, users: rows };
}

function getUserById(id) {
  const db = getDb();
  return safeUser(db.prepare("SELECT * FROM users WHERE id = ?").get(id));
}

function updateUser(id, updates) {
  const db = getDb();
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  if (!user) {
    const err = new Error("User not found");
    err.status = 404;
    throw err;
  }

  const allowed = ["name", "role", "status"];
  const fields = [];
  const values = [];

  for (const key of allowed) {
    if (updates[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
  }

  if (fields.length === 0) {
    const err = new Error("No valid fields to update");
    err.status = 400;
    throw err;
  }

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  return safeUser(db.prepare("SELECT * FROM users WHERE id = ?").get(id));
}

function verifyCredentials(email, password) {
  const db = getDb();
  const user = db.prepare("SELECT * FROM users WHERE email = ? AND status = 'active'").get(email);
  if (!user) return null;
  const valid = bcrypt.compareSync(password, user.password);
  return valid ? safeUser(user) : null;
}

module.exports = { createUser, listUsers, getUserById, updateUser, verifyCredentials };
