import assert from "node:assert/strict";
import test from "node:test";
import {
  ANALYTICS_ENERGY_PROXY_NOTE,
  getAnalyticsDriverPairKey,
  validateAnalyticsCompareParams,
} from "./analytics-product";

test("validateAnalyticsCompareParams requires session and both drivers", () => {
  const result = validateAnalyticsCompareParams({
    sessionId: "2020_01_FP1_Austrian Grand Prix",
    driverA: "VER",
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "bad_request");
  }
});

test("validateAnalyticsCompareParams rejects self-comparison", () => {
  const result = validateAnalyticsCompareParams({
    sessionId: "2020_01_FP1_Austrian Grand Prix",
    driverA: "ver",
    driverB: "VER",
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "validation_error");
  }
});

test("validateAnalyticsCompareParams normalizes accepted driver codes", () => {
  const result = validateAnalyticsCompareParams({
    sessionId: " 2020_01_FP1_Austrian Grand Prix ",
    driverA: " alb ",
    driverB: " bot ",
  });

  assert.deepEqual(result, {
    ok: true,
    value: {
      sessionId: "2020_01_FP1_Austrian Grand Prix",
      driverA: "ALB",
      driverB: "BOT",
    },
  });
});

test("getAnalyticsDriverPairKey avoids reversed duplicate assumptions", () => {
  assert.equal(
    getAnalyticsDriverPairKey("2020_01_FP1_Austrian Grand Prix", "BOT", "ALB"),
    getAnalyticsDriverPairKey("2020_01_FP1_Austrian Grand Prix", "ALB", "BOT"),
  );
});

test("energy wording remains explicitly proxy-based", () => {
  const note = ANALYTICS_ENERGY_PROXY_NOTE.toLowerCase();

  assert.match(note, /proxy/);
  assert.match(note, /not true/);
  assert.match(note, /ers|battery/);
});
