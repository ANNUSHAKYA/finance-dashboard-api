// src/services/dashboardService.js
// Aggregation queries that power the dashboard.
// All queries exclude soft-deleted records.
// groupBy helpers use parameterized strftime for safety.

const { getDb } = require("../db");

function getSummary({ dateFrom, dateTo } = {}) {
  const db = getDb();
  const { conditions, params } = buildDateFilter(dateFrom, dateTo);

  const where = conditions.length ? `AND ${conditions.join(" AND ")}` : "";

  const row = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END), 0) AS total_income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS total_expenses,
      COALESCE(SUM(CASE WHEN type = 'income'  THEN amount
                        WHEN type = 'expense' THEN -amount END), 0)       AS net_balance,
      COUNT(*) AS record_count
    FROM records
    WHERE deleted = 0 ${where}
  `).get(...params);

  return row;
}

function getCategoryTotals({ type, dateFrom, dateTo } = {}) {
  const db = getDb();
  const { conditions, params } = buildDateFilter(dateFrom, dateTo);

  if (type) {
    conditions.push("type = ?");
    params.push(type);
  }

  const where = conditions.length ? `AND ${conditions.join(" AND ")}` : "";

  return db.prepare(`
    SELECT
      category,
      type,
      COUNT(*)          AS count,
      SUM(amount)       AS total,
      AVG(amount)       AS average
    FROM records
    WHERE deleted = 0 ${where}
    GROUP BY category, type
    ORDER BY total DESC
  `).all(...params);
}

function getMonthlyTrend({ year } = {}) {
  const db = getDb();
  const params = [];
  let yearFilter = "";
  if (year) {
    yearFilter = "AND strftime('%Y', date) = ?";
    params.push(String(year));
  }

  return db.prepare(`
    SELECT
      strftime('%Y-%m', date)                                               AS month,
      COALESCE(SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END), 0) AS income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expenses,
      COALESCE(SUM(CASE WHEN type = 'income'  THEN amount
                        WHEN type = 'expense' THEN -amount END), 0)       AS net
    FROM records
    WHERE deleted = 0 ${yearFilter}
    GROUP BY month
    ORDER BY month ASC
  `).all(...params);
}

function getWeeklyTrend({ weeksBack = 12 } = {}) {
  const db = getDb();
  return db.prepare(`
    SELECT
      strftime('%Y-W%W', date)                                              AS week,
      COALESCE(SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END), 0) AS income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expenses
    FROM records
    WHERE deleted = 0
      AND date >= date('now', ? || ' days')
    GROUP BY week
    ORDER BY week ASC
  `).all([`-${weeksBack * 7}`]);
}

function getRecentActivity({ limit = 10 } = {}) {
  const db = getDb();
  return db.prepare(`
    SELECT r.*, u.name AS created_by_name
    FROM records r
    JOIN users u ON r.created_by = u.id
    WHERE r.deleted = 0
    ORDER BY r.created_at DESC
    LIMIT ?
  `).all(limit);
}

// --- helpers ---

function buildDateFilter(dateFrom, dateTo) {
  const conditions = [];
  const params = [];
  if (dateFrom) { conditions.push("date >= ?"); params.push(dateFrom); }
  if (dateTo)   { conditions.push("date <= ?"); params.push(dateTo);   }
  return { conditions, params };
}

module.exports = { getSummary, getCategoryTotals, getMonthlyTrend, getWeeklyTrend, getRecentActivity };
