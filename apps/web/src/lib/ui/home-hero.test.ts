import assert from "node:assert/strict";
import test from "node:test";
import { formatCountdown, formatRaceDateUtc, getCircuitDisplayName } from "./home-hero";

test("resolves registered and unknown circuit labels", () => {
  assert.equal(getCircuitDisplayName("red_bull_ring"), "Red Bull Ring");
  assert.equal(getCircuitDisplayName("unknown-circuit"), "Circuit pending");
  assert.equal(getCircuitDisplayName(null), "Circuit pending");
});

test("formats race schedules explicitly in UTC", () => {
  assert.equal(formatRaceDateUtc("2026-06-28T13:00:00Z"), "Jun 28, 2026 - 13:00 UTC");
  assert.equal(formatRaceDateUtc(null), "Schedule pending");
  assert.equal(formatRaceDateUtc("not-a-date"), "Schedule pending");
});

test("formats countdown states", () => {
  const now = new Date("2026-06-27T12:00:00Z").getTime();
  assert.equal(formatCountdown("2026-06-28T13:00:00Z", now), "1d 1h to lights out");
  assert.equal(formatCountdown(null, now), "Race time pending");
  assert.equal(formatCountdown("2026-06-26T13:00:00Z", now), "Race window active");
});
