import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ANALYTICS_ENERGY_PROXY_NOTE,
  ANALYTICS_DETAIL_ROW_CAP,
  getAnalyticsDriverPairKey,
  getAnalyticsComparison,
  getAnalyticsDefaultDriverPair,
  getAnalyticsDrivers,
  listAnalyticsSessions,
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
      mode: "overview",
    },
  });
});

test("validateAnalyticsCompareParams rejects invalid comparison modes", () => {
  const result = validateAnalyticsCompareParams({
    sessionId: "2020_01_FP1_Austrian Grand Prix",
    driverA: "ALB",
    driverB: "BOT",
    mode: "battery",
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "validation_error");
  }
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

test("Analytics comparison detail payload is capped and proxy-safe", async () => {
  const sessions = await listAnalyticsSessions();
  const session = sessions[0];
  assert.ok(session);

  const drivers = await getAnalyticsDrivers(session.id);
  assert.ok(drivers.length >= 2);

  const comparison = await getAnalyticsComparison(session.id, drivers[0].code, drivers[1].code, "energy-proxy");
  assert.ok(comparison);
  assert.equal(comparison.detailMode, "energy-proxy");
  assert.equal(comparison.segmentHighlights.length, 0);
  assert.ok(comparison.energyProxyHighlights.length <= ANALYTICS_DETAIL_ROW_CAP);
  assert.match(comparison.proxyNote.toLowerCase(), /proxy/);
  assert.doesNotMatch(comparison.proxyNote.toLowerCase(), /battery usage|ers data/);
});

test("Analytics default driver pair is deterministic and usable", async () => {
  const sessions = await listAnalyticsSessions();
  const session = sessions[0];
  assert.ok(session);

  const pair = await getAnalyticsDefaultDriverPair(session.id);
  assert.ok(pair);
  assert.notEqual(pair.driverA, pair.driverB);

  const comparison = await getAnalyticsComparison(session.id, pair.driverA, pair.driverB, "overview");
  assert.ok(comparison);
  assert.equal(comparison.overview.driverA, pair.driverA);
  assert.equal(comparison.overview.driverB, pair.driverB);
});

test("Analytics sessions expose latest Miami race data first when available", async () => {
  const sessions = await listAnalyticsSessions();
  assert.ok(sessions.length > 0);

  assert.equal(sessions[0].season, 2026);
  assert.equal(sessions[0].round, 4);
  assert.equal(sessions[0].session, "R");

  const miamiRace = sessions.find((session) => session.season === 2026 && session.round === 4 && session.session === "R");
  assert.ok(miamiRace);
});

test("Analytics comparison detail modes expose capped selectable segment rows", async () => {
  const sessions = await listAnalyticsSessions();
  const session = sessions[0];
  assert.ok(session);

  const drivers = await getAnalyticsDrivers(session.id);
  assert.ok(drivers.length >= 2);

  const segments = await getAnalyticsComparison(session.id, drivers[0].code, drivers[1].code, "segments");
  const braking = await getAnalyticsComparison(session.id, drivers[0].code, drivers[1].code, "braking");
  const straights = await getAnalyticsComparison(session.id, drivers[0].code, drivers[1].code, "straights");

  assert.ok(segments);
  assert.ok(braking);
  assert.ok(straights);
  assert.ok(segments.segmentHighlights.length <= ANALYTICS_DETAIL_ROW_CAP);
  assert.ok(braking.brakingHighlights.length <= ANALYTICS_DETAIL_ROW_CAP);
  assert.ok(straights.straightHighlights.length <= ANALYTICS_DETAIL_ROW_CAP);
  assert.ok(segments.segmentHighlights.every((row) => row.segmentId && row.segmentKind.toLowerCase().includes("segment")));
  assert.ok(straights.straightHighlights.every((row) => row.segmentId));
});

test("Analytics comparison returns unavailable for missing indexed session", async () => {
  const comparison = await getAnalyticsComparison("missing-session", "AAA", "BBB", "segments");

  assert.equal(comparison, null);
});

test("Analytics product helper does not import raw telemetry runtime paths", async () => {
  const source = await readFile(new URL("./analytics-product.ts", import.meta.url), "utf-8");

  assert.doesNotMatch(source, /raw\/fastf1|telemetry_features|fastf1_downloader|fastf1_pipeline/);
  assert.doesNotMatch(source, /analytics\.segmentComparison|analytics\.brakingComparison|analytics\.throttleComparison|analytics\.straightComparison|analytics\.energyProxyComparison/);
});
