// src/services/recordService.js
// Financial record operations: create, read, update, soft-delete, filter.
// Soft delete sets deleted=1 rather than removing the row,
// which preserves audit history and makes recovery possible.

const { v4: uuidv4 } = require("uuid");
const { getDb } = require("../db");

function createRecord({ amount, type, category, date, notes }, userId) {
  const db = getDb();
  const id = uuidv4();

  db.prepare(`
    INSERT INTO records (id, amount, type, category, date, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, amount, type, category, date, notes ?? null, userId);

  return db.prepare("SELECT * FROM records WHERE id = ?").get(id);
}

function listRecords({ page = 1, limit = 20, type, category, dateFrom, dateTo, search } = {}) {
  const db = getDb();
  const offset = (page - 1) * limit;

  const conditions = ["deleted = 0"];
  const params = [];

  if (type) {
    conditions.push("type = ?");
    params.push(type);
  }
  if (category) {
    conditions.push("category = ?");
    params.push(category);
  }
  if (dateFrom) {
    conditions.push("date >= ?");
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push("date <= ?");
    params.push(dateTo);
  }
  if (search) {
    conditions.push("(category LIKE ? OR notes LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const total = db.prepare(`SELECT COUNT(*) as n FROM records ${where}`).get(...params).n;
  const rows = db
    .prepare(`SELECT * FROM records ${where} ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset);

  return { total, page, limit, records: rows };
}

function getRecordById(id) {
  const db = getDb();
  const record = db.prepare("SELECT * FROM records WHERE id = ? AND deleted = 0").get(id);
  if (!record) {
    const err = new Error("Record not found");
    err.status = 404;
    throw err;
  }
  return record;
}

function updateRecord(id, updates) {
  const db = getDb();
  const record = db.prepare("SELECT * FROM records WHERE id = ? AND deleted = 0").get(id);
  if (!record) {
    const err = new Error("Record not found");
    err.status = 404;
    throw err;
  }

  const allowed = ["amount", "type", "category", "date", "notes"];
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

  db.prepare(`UPDATE records SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  return db.prepare("SELECT * FROM records WHERE id = ?").get(id);
}

function deleteRecord(id) {
  const db = getDb();
  const record = db.prepare("SELECT * FROM records WHERE id = ? AND deleted = 0").get(id);
  if (!record) {
    const err = new Error("Record not found");
    err.status = 404;
    throw err;
  }
  // Soft delete
  db.prepare("UPDATE records SET deleted = 1, updated_at = datetime('now') WHERE id = ?").run(id);
}

module.exports = { createRecord, listRecords, getRecordById, updateRecord, deleteRecord };
