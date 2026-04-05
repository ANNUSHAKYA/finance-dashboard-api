// src/routes/records.js
// Financial record CRUD.
// Viewers: read-only.
// Analysts: read-only (same as viewer for records).
// Admins: full CRUD.

const express = require("express");
const router = express.Router();
const { authenticate, requireRole } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { createRecordSchema, updateRecordSchema } = require("../utils/schemas");
const recordService = require("../services/recordService");

router.use(authenticate);

/**
 * GET /records
 * Roles: viewer, analyst, admin
 * Query: ?page&limit&type&category&dateFrom&dateTo&search
 */
router.get("/", (req, res) => {
  const page     = Math.max(1, parseInt(req.query.page)  || 1);
  const limit    = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const type     = ["income", "expense"].includes(req.query.type) ? req.query.type : undefined;
  const category = req.query.category || undefined;
  const dateFrom = req.query.dateFrom || undefined;
  const dateTo   = req.query.dateTo   || undefined;
  const search   = req.query.search   || undefined;

  const result = recordService.listRecords({ page, limit, type, category, dateFrom, dateTo, search });
  res.json(result);
});

/**
 * GET /records/:id
 * Roles: viewer, analyst, admin
 */
router.get("/:id", (req, res) => {
  const record = recordService.getRecordById(req.params.id);
  res.json({ record });
});

/**
 * POST /records
 * Roles: admin only
 */
router.post("/", requireRole("admin"), validate(createRecordSchema), (req, res) => {
  const record = recordService.createRecord(req.body, req.user.id);
  res.status(201).json({ record });
});

/**
 * PATCH /records/:id
 * Roles: admin only
 */
router.patch("/:id", requireRole("admin"), validate(updateRecordSchema), (req, res) => {
  const record = recordService.updateRecord(req.params.id, req.body);
  res.json({ record });
});

/**
 * DELETE /records/:id
 * Roles: admin only
 * Soft-delete — sets deleted=1, data is preserved.
 */
router.delete("/:id", requireRole("admin"), (req, res) => {
  recordService.deleteRecord(req.params.id);
  res.json({ message: "Record deleted successfully" });
});

module.exports = router;
