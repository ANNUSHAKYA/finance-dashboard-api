// src/app.js
// Express application setup.
// Error handling is centralized at the bottom.

const express = require("express");
const app = express();

app.use(express.json());

// --- Routes ---
app.use("/auth",      require("./routes/auth"));
app.use("/users",     require("./routes/users"));
app.use("/records",   require("./routes/records"));
app.use("/dashboard", require("./routes/dashboard"));

// Health check
app.get("/health", (req, res) => res.json({ status: "ok" }));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// Central error handler
// Handles errors thrown from services (with .status) and unexpected errors.
app.use((err, req, res, next) => {
  const status = err.status || 500;
  const message = status < 500 ? err.message : "Internal server error";

  if (status >= 500) {
    console.error("[ERROR]", err);
  }

  res.status(status).json({ error: message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Finance Dashboard API running on http://localhost:${PORT}`);

  // Seed default admin on first run
  seedAdminIfNeeded();
});

function seedAdminIfNeeded() {
  const { getDb } = require("./db");
  const bcrypt = require("bcryptjs");
  const { v4: uuidv4 } = require("uuid");
  const db = getDb();

  const existing = db.prepare("SELECT id FROM users WHERE role = 'admin'").get();
  if (!existing) {
    const id = uuidv4();
    const password = bcrypt.hashSync("admin123", 10);
    db.prepare(`
      INSERT INTO users (id, name, email, password, role)
      VALUES (?, 'Admin', 'admin@example.com', ?, 'admin')
    `).run(id, password);
    console.log("Seeded default admin: admin@example.com / admin123");
  }
}

module.exports = app;
