// src/utils/schemas.js
// All Zod validation schemas in one place.
// Keeps validation logic decoupled from routes and services.

const { z } = require("zod");

// --- Auth ---

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// --- Users ---

const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(6).max(100),
  role: z.enum(["admin", "analyst", "viewer"]),
});

const updateUserSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    role: z.enum(["admin", "analyst", "viewer"]).optional(),
    status: z.enum(["active", "inactive"]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

// --- Records ---

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const createRecordSchema = z.object({
  amount: z.number().positive("Amount must be a positive number"),
  type: z.enum(["income", "expense"]),
  category: z.string().min(1).max(100),
  date: z.string().regex(ISO_DATE, "Date must be in YYYY-MM-DD format"),
  notes: z.string().max(500).optional(),
});

const updateRecordSchema = z
  .object({
    amount: z.number().positive().optional(),
    type: z.enum(["income", "expense"]).optional(),
    category: z.string().min(1).max(100).optional(),
    date: z.string().regex(ISO_DATE).optional(),
    notes: z.string().max(500).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

module.exports = {
  loginSchema,
  createUserSchema,
  updateUserSchema,
  createRecordSchema,
  updateRecordSchema,
};
