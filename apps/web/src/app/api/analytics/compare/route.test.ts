import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "./route";

test("Analytics compare endpoint rejects self-comparison before loading data", async () => {
  const response = await GET(new Request("https://f1-insightx.test/api/analytics/compare?sessionId=test-session&driverA=VER&driverB=VER"));
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, "validation_error");
});

test("Analytics compare endpoint requires all query params", async () => {
  const response = await GET(new Request("https://f1-insightx.test/api/analytics/compare?sessionId=test-session&driverA=VER"));
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, "bad_request");
});

test("Analytics compare endpoint rejects invalid modes before loading data", async () => {
  const response = await GET(new Request("https://f1-insightx.test/api/analytics/compare?sessionId=test-session&driverA=VER&driverB=HAM&mode=battery"));
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, "validation_error");
});
