import assert from "node:assert/strict";
import test from "node:test";
import { classifyStrategyLabUnavailable } from "./response";

test("classifyStrategyLabUnavailable returns 404 for non-materialized races", () => {
  const result = classifyStrategyLabUnavailable({
    surface: "strategy-lab",
    mode: "unavailable",
    sourceKind: null,
    sourceLabel: null,
    reason: "Primary strategy_lab_views returned no data.",
    generatedAt: null,
    buildVersion: null,
    eventId: null,
    season: null,
    round: null,
  });

  assert.deepEqual(result, {
    status: 404,
    code: "not_found",
    message: "Strategy Lab data has not been materialized for this race.",
  });
});

test("classifyStrategyLabUnavailable returns 503 for product-layer failures", () => {
  const result = classifyStrategyLabUnavailable({
    surface: "strategy-lab",
    mode: "unavailable",
    sourceKind: null,
    sourceLabel: null,
    reason: "Primary failed (timeout); degraded strategy_lab_csv failed (missing required dataset).",
    generatedAt: null,
    buildVersion: null,
    eventId: null,
    season: null,
    round: null,
  });

  assert.deepEqual(result, {
    status: 503,
    code: "service_unavailable",
    message: "Strategy Lab product data is unavailable right now.",
  });
});
