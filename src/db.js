// src/db.js
// SQLite database initialization using better-sqlite3
// Schema is defined here and auto-applied on startup.

const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "finance.db");

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL"); // better concurrency
    db.pragma("foreign_keys = ON");
    applySchema(db);
  }
  return db;
}

function applySchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      email       TEXT UNIQUE NOT NULL,
      password    TEXT NOT NULL,
      role        TEXT NOT NULL CHECK(role IN ('admin', 'analyst', 'viewer')),
      status      TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS records (
      id          TEXT PRIMARY KEY,
      amount      REAL NOT NULL CHECK(amount > 0),
      type        TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      category    TEXT NOT NULL,
      date        TEXT NOT NULL,
      notes       TEXT,
      created_by  TEXT NOT NULL REFERENCES users(id),
      deleted     INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_records_type     ON records(type)     WHERE deleted = 0;
    CREATE INDEX IF NOT EXISTS idx_records_category ON records(category) WHERE deleted = 0;
    CREATE INDEX IF NOT EXISTS idx_records_date     ON records(date)     WHERE deleted = 0;
    CREATE INDEX IF NOT EXISTS idx_records_deleted  ON records(deleted);
  `);
}

module.exports = { getDb };
