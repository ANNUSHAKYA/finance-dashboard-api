// tests/run.js
// Lightweight integration tests using only Node's built-in http.
// Run: node tests/run.js
// The server must be running on localhost:3000 (npm start) before running tests.

const http = require("http");

const BASE = "http://localhost:3000";
let passed = 0;
let failed = 0;
let adminToken = "";
let createdUserId = "";
let createdRecordId = "";

async function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: "localhost",
      port: 3000,
      path,
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
      },
    };

    const reqObj = http.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    reqObj.on("error", reject);
    if (payload) reqObj.write(payload);
    reqObj.end();
  });
}

function assert(label, condition, detail = "") {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function run() {
  console.log("\n=== Finance Dashboard API Tests ===\n");

  // --- Health ---
  console.log("[ Health ]");
  const health = await req("GET", "/health");
  assert("GET /health returns 200", health.status === 200);

  // --- Auth ---
  console.log("\n[ Auth ]");

  const badLogin = await req("POST", "/auth/login", { email: "x@x.com", password: "wrong" });
  assert("Bad login returns 401", badLogin.status === 401);

  const validLogin = await req("POST", "/auth/login", { email: "admin@example.com", password: "admin123" });
  assert("Admin login succeeds", validLogin.status === 200);
  assert("Login returns token", !!validLogin.body.token);
  adminToken = validLogin.body.token;

  const me = await req("GET", "/auth/me", null, adminToken);
  assert("GET /auth/me returns user", me.status === 200 && me.body.user.role === "admin");

  // --- Users ---
  console.log("\n[ Users ]");

  const noAuth = await req("GET", "/users");
  assert("GET /users without token returns 401", noAuth.status === 401);

  const newUser = await req("POST", "/users", {
    name: "Test Viewer",
    email: `viewer_${Date.now()}@test.com`,
    password: "password123",
    role: "viewer",
  }, adminToken);
  assert("Admin can create a viewer", newUser.status === 201);
  createdUserId = newUser.body.user?.id;

  const getUser = await req("GET", `/users/${createdUserId}`, null, adminToken);
  assert("Admin can fetch user by id", getUser.status === 200);

  const updateUser = await req("PATCH", `/users/${createdUserId}`, { status: "inactive" }, adminToken);
  assert("Admin can deactivate user", updateUser.status === 200 && updateUser.body.user.status === "inactive");

  const badUserCreate = await req("POST", "/users", { name: "", email: "notanemail", password: "x", role: "god" }, adminToken);
  assert("Invalid user body returns 400", badUserCreate.status === 400);

  // --- Records ---
  console.log("\n[ Records ]");

  const newRecord = await req("POST", "/records", {
    amount: 1500.50,
    type: "income",
    category: "Consulting",
    date: "2024-03-01",
    notes: "March consulting fee",
  }, adminToken);
  assert("Admin can create record", newRecord.status === 201);
  createdRecordId = newRecord.body.record?.id;

  // Viewer login
  const viewerEmail = `viewer_${Date.now()}@test.com`;
  await req("POST", "/users", { name: "Viewer2", email: viewerEmail, password: "pass123", role: "viewer" }, adminToken);
  const viewerLogin = await req("POST", "/auth/login", { email: viewerEmail, password: "pass123" });
  const viewerToken = viewerLogin.body.token;

  const viewerCreate = await req("POST", "/records", {
    amount: 200, type: "expense", category: "Office", date: "2024-03-02",
  }, viewerToken);
  assert("Viewer cannot create record (403)", viewerCreate.status === 403);

  const listRecords = await req("GET", "/records", null, viewerToken);
  assert("Viewer can list records", listRecords.status === 200);

  const getRecord = await req("GET", `/records/${createdRecordId}`, null, viewerToken);
  assert("Viewer can get record by id", getRecord.status === 200);

  const patchRecord = await req("PATCH", `/records/${createdRecordId}`, { amount: 2000 }, adminToken);
  assert("Admin can update record", patchRecord.status === 200 && patchRecord.body.record.amount === 2000);

  const badRecord = await req("POST", "/records", { amount: -50, type: "bad", category: "", date: "not-a-date" }, adminToken);
  assert("Invalid record body returns 400", badRecord.status === 400);

  await req("POST", "/records", { amount: 300, type: "expense", category: "Rent", date: "2024-03-05" }, adminToken);
  await req("POST", "/records", { amount: 750, type: "income", category: "Sales", date: "2024-02-10" }, adminToken);

  const filtered = await req("GET", "/records?type=income", null, adminToken);
  assert("Filter records by type=income", filtered.status === 200 && filtered.body.records.every(r => r.type === "income"));

  const deleteRecord = await req("DELETE", `/records/${createdRecordId}`, null, adminToken);
  assert("Admin can soft-delete record", deleteRecord.status === 200);

  const afterDelete = await req("GET", `/records/${createdRecordId}`, null, adminToken);
  assert("Soft-deleted record returns 404", afterDelete.status === 404);

  // --- Dashboard ---
  console.log("\n[ Dashboard ]");

  const summary = await req("GET", "/dashboard/summary", null, adminToken);
  assert("GET /dashboard/summary works", summary.status === 200 && "total_income" in summary.body);

  const cats = await req("GET", "/dashboard/categories", null, adminToken);
  assert("GET /dashboard/categories works", cats.status === 200 && Array.isArray(cats.body.categories));

  const monthly = await req("GET", "/dashboard/trends/monthly?year=2024", null, adminToken);
  assert("GET /dashboard/trends/monthly works", monthly.status === 200 && Array.isArray(monthly.body.trend));

  const weekly = await req("GET", "/dashboard/trends/weekly", null, adminToken);
  assert("GET /dashboard/trends/weekly works", weekly.status === 200);

  const recent = await req("GET", "/dashboard/recent?limit=5", null, adminToken);
  assert("GET /dashboard/recent works", recent.status === 200 && Array.isArray(recent.body.recent));

  // --- 404 ---
  console.log("\n[ Misc ]");
  const notFound = await req("GET", "/nonexistent");
  assert("Unknown route returns 404", notFound.status === 404);

  // --- Summary ---
  console.log(`\n${"=".repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error("Test runner error:", err.message);
  console.error("Is the server running on port 3000? (npm start)");
  process.exit(1);
});
