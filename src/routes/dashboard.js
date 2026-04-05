// src/routes/dashboard.js
// Summary and analytics endpoints.
// Accessible to all authenticated users (viewer and above).

const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const dashboardService = require("../services/dashboardService");

router.use(authenticate);

/**
 * GET /dashboard/summary
 * Query: ?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD
 * Returns: total income, expenses, net balance, record count
 */
router.get("/summary", (req, res) => {
  const summary = dashboardService.getSummary({
    dateFrom: req.query.dateFrom,
    dateTo:   req.query.dateTo,
  });
  res.json(summary);
});

/**
 * GET /dashboard/categories
 * Query: ?type=income|expense&dateFrom&dateTo
 * Returns: category-wise totals and averages
 */
router.get("/categories", (req, res) => {
  const type = ["income", "expense"].includes(req.query.type) ? req.query.type : undefined;
  const data = dashboardService.getCategoryTotals({
    type,
    dateFrom: req.query.dateFrom,
    dateTo:   req.query.dateTo,
  });
  res.json({ categories: data });
});

/**
 * GET /dashboard/trends/monthly
 * Query: ?year=2024
 * Returns: monthly income / expenses / net grouped by month
 */
router.get("/trends/monthly", (req, res) => {
  const year = req.query.year ? parseInt(req.query.year) : undefined;
  const data = dashboardService.getMonthlyTrend({ year });
  res.json({ trend: data });
});

/**
 * GET /dashboard/trends/weekly
 * Query: ?weeksBack=12
 * Returns: weekly income / expenses for the last N weeks
 */
router.get("/trends/weekly", (req, res) => {
  const weeksBack = Math.min(52, Math.max(1, parseInt(req.query.weeksBack) || 12));
  const data = dashboardService.getWeeklyTrend({ weeksBack });
  res.json({ trend: data });
});

/**
 * GET /dashboard/recent
 * Query: ?limit=10
 * Returns: most recent N financial records with creator name
 */
router.get("/recent", (req, res) => {
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
  const data = dashboardService.getRecentActivity({ limit });
  res.json({ recent: data });
});

module.exports = router;
