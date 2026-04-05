# Finance Dashboard API

A RESTful backend for a role-based finance dashboard system. Built with **Node.js**, **Express**, and **SQLite** (via `better-sqlite3`).

---

## Tech Stack

| Layer       | Choice              | Reason                                                                 |
|-------------|---------------------|------------------------------------------------------------------------|
| Runtime     | Node.js             | Fast I/O, well-suited for API servers                                  |
| Framework   | Express             | Minimal, explicit, industry-standard                                   |
| Database    | SQLite (better-sqlite3) | Zero-config persistence; synchronous API keeps code simple and readable |
| Auth        | JWT (jsonwebtoken)  | Stateless, easy to integrate with frontend dashboards                  |
| Validation  | Zod                 | Type-safe schema validation with clear error messages                  |
| Passwords   | bcryptjs            | Industry-standard password hashing                                     |

---

## Setup

### Prerequisites
- Node.js 18+
- npm

### Installation

```bash
git clone <repo-url>
cd finance-dashboard
npm install
```

### Start the server

```bash
npm start        # production
npm run dev      # with nodemon auto-reload
```

Server runs at `http://localhost:3000`.  
On first boot, a default admin account is seeded automatically:

```
Email:    admin@example.com
Password: admin123
```

> Change this in production via environment variables or a migration.

### Environment variables (optional)

| Variable     | Default                          | Description           |
|--------------|----------------------------------|-----------------------|
| `PORT`       | `3000`                           | Port to listen on     |
| `JWT_SECRET` | `finance-dashboard-secret-key`   | JWT signing secret    |

---

## Project Structure

```
src/
├── app.js                  # Express setup, error handling, entry point
├── db.js                   # SQLite connection + schema
├── middleware/
│   ├── auth.js             # JWT verification + role guards
│   └── validate.js         # Zod schema validation middleware
├── routes/
│   ├── auth.js             # Login, /me
│   ├── users.js            # User management
│   ├── records.js          # Financial record CRUD
│   └── dashboard.js        # Aggregation endpoints
├── services/
│   ├── userService.js      # User business logic
│   ├── recordService.js    # Record business logic
│   └── dashboardService.js # Analytics queries
└── utils/
    └── schemas.js          # All Zod validation schemas
tests/
└── run.js                  # Integration tests (no dependencies)
```

---

## Role Model

| Role     | Records (read) | Records (write/delete) | Users (read) | Users (manage) | Dashboard |
|----------|:--------------:|:---------------------:|:------------:|:--------------:|:---------:|
| viewer   | ✅             | ❌                    | Self only    | ❌             | ✅        |
| analyst  | ✅             | ❌                    | Self only    | ❌             | ✅        |
| admin    | ✅             | ✅                    | ✅           | ✅             | ✅        |

Role enforcement is done via the `requireRole(minRole)` middleware in `src/middleware/auth.js`. Roles are ordered by privilege: `viewer < analyst < admin`. Passing `requireRole('analyst')` allows both analysts and admins through.

---

## API Reference

All endpoints that require authentication expect:
```
Authorization: Bearer <token>
```

### Auth

#### `POST /auth/login`
```json
{ "email": "admin@example.com", "password": "admin123" }
```
Response:
```json
{ "token": "...", "user": { "id": "...", "name": "Admin", "role": "admin" } }
```

#### `GET /auth/me`
Returns the currently authenticated user.

---

### Users

#### `GET /users` — admin only
Query: `?page=1&limit=20&status=active`

#### `POST /users` — admin only
```json
{
  "name": "Alice",
  "email": "alice@example.com",
  "password": "securepass",
  "role": "analyst"
}
```

#### `GET /users/:id` — admin or self

#### `PATCH /users/:id` — admin only
```json
{ "role": "viewer", "status": "inactive" }
```

---

### Records

#### `GET /records` — all roles
Query params:
- `page`, `limit`
- `type` — `income` or `expense`
- `category` — exact match
- `dateFrom`, `dateTo` — `YYYY-MM-DD`
- `search` — searches category and notes

#### `GET /records/:id` — all roles

#### `POST /records` — admin only
```json
{
  "amount": 1500.00,
  "type": "income",
  "category": "Consulting",
  "date": "2024-03-01",
  "notes": "Optional description"
}
```

#### `PATCH /records/:id` — admin only
Any subset of the fields above.

#### `DELETE /records/:id` — admin only
Soft delete — data is preserved with `deleted=1`. Deleted records are excluded from all queries.

---

### Dashboard

All endpoints accessible to every authenticated user.

#### `GET /dashboard/summary`
Query: `?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD`
```json
{
  "total_income": 5000,
  "total_expenses": 2000,
  "net_balance": 3000,
  "record_count": 12
}
```

#### `GET /dashboard/categories`
Query: `?type=income&dateFrom=...&dateTo=...`
```json
{
  "categories": [
    { "category": "Consulting", "type": "income", "count": 3, "total": 4500, "average": 1500 }
  ]
}
```

#### `GET /dashboard/trends/monthly`
Query: `?year=2024`
```json
{
  "trend": [
    { "month": "2024-01", "income": 2000, "expenses": 800, "net": 1200 }
  ]
}
```

#### `GET /dashboard/trends/weekly`
Query: `?weeksBack=12`

#### `GET /dashboard/recent`
Query: `?limit=10`
Returns the most recent records with creator name joined in.

---

## Running Tests

```bash
# Terminal 1 — start the server
npm start

# Terminal 2 — run tests
npm test
```

The test runner (`tests/run.js`) uses only Node's built-in `http` module (no test framework required). It covers:
- Authentication (valid/invalid login, token verification)
- Role enforcement (viewer blocked from writes, admin allowed)
- Record CRUD and soft-delete behaviour
- Filtering records by type
- All dashboard endpoints
- Validation errors (bad input → 400)
- 404 for unknown routes

---

## Design Decisions & Assumptions

### SQLite
Chosen for zero-config portability. The synchronous `better-sqlite3` API keeps service code clean (no async/await chains for simple queries). Swapping to PostgreSQL would only require changing `db.js` and adjusting a few SQL dialect differences (e.g., `datetime('now')` → `NOW()`).

### Soft Delete
Records use `deleted = 1` rather than physical deletion. This preserves audit history and makes accidental deletion recoverable. All queries filter `WHERE deleted = 0` by default.

### Role Hierarchy
Roles are compared by level (`viewer=0, analyst=1, admin=2`) rather than a list of permissions. This keeps the middleware simple while still making the access model explicit and extensible — adding a new role only requires updating the `ROLE_LEVEL` map.

### Analyst vs Viewer
Both roles are read-only for records in this implementation. The distinction is kept in the role model and enforced via `requireRole()` so that analyst-specific endpoints (e.g., export, advanced analytics) can be added later without refactoring.

### Validation
All input is validated with Zod before reaching service logic. Error responses include a structured `issues` array with field paths, making them easy for a frontend to consume.

### No Pagination on Dashboard
Dashboard endpoints return all aggregated rows (monthly trend, categories) since the result sets are naturally bounded. Record listing supports full pagination.

### JWT Expiry
Tokens expire in 8 hours. In production, a refresh token mechanism would be added.

---

## Potential Improvements (not implemented)

- Refresh tokens
- Rate limiting (e.g., `express-rate-limit`)
- Audit log table (who changed what, when)
- CSV/PDF export for records
- User self-service password change
- Role: `analyst` allowed to add notes/tags but not amounts
- OpenAPI/Swagger docs
