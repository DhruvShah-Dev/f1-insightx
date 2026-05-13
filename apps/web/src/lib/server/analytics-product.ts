import { cache } from "react";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { gunzip } from "node:zlib";
import { parseNumber, readCsvFile } from "@/lib/server/csv";
import { getRuntimeData, resolveRuntimeSource, type RuntimeSourceMetadata, type RuntimeSourceResult } from "@/lib/server/runtime-source";

type Numeric = number | string | null | undefined;

type SessionIndexRow = {
  session_id: string;
  season: Numeric;
  round: Numeric;
  event: string;
  session: string;
  driver_count: Numeric;
  segment_count: Numeric;
  straight_count: Numeric;
  telemetry_quality_mean: Numeric;
  track_archetype: string;
  generated_at: string;
  build_version: string;
};

type DriverComparisonRow = {
  session_id: string;
  driver_a: string;
  driver_b: string;
  driver_a_team: string;
  driver_b_team: string;
  corner_advantage_count_a: Numeric;
  corner_advantage_count_b: Numeric;
  straight_advantage_count_a: Numeric;
  straight_advantage_count_b: Numeric;
  avg_segment_delta_kph: Numeric;
  avg_straight_delta_kph: Numeric;
  braking_advantage_score: Numeric;
  traction_advantage_score: Numeric;
  energy_proxy_delta: Numeric;
  confidence: Numeric;
  weakest_assumption: string;
  strategy_relevance_note: string;
};

type TrackSummaryRow = {
  session_id: string;
  track_archetype: string;
  straight_line_weight: Numeric;
  braking_weight: Numeric;
  traction_weight: Numeric;
  degradation_weight: Numeric;
  track_position_weight: Numeric;
  archetype_confidence: Numeric;
};

type SegmentComparisonRow = {
  session_id: string;
  segment_id: string;
  segment_kind: string;
  segment_confidence: Numeric;
  driver_a: string;
  driver_b: string;
  entry_speed_delta_kph: Numeric;
  apex_speed_delta_kph: Numeric;
  exit_speed_delta_kph: Numeric;
  min_speed_delta_kph: Numeric;
  faster_driver: string;
  confidence: Numeric;
};

type BrakingComparisonRow = {
  session_id: string;
  segment_id: string;
  driver_a: string;
  driver_b: string;
  braking_start_delta_m: Numeric;
  braking_duration_delta_s: Numeric;
  braking_distance_delta_m: Numeric;
  late_brake_delta: Numeric;
  brake_intensity_delta: Numeric;
  confidence: Numeric;
  favorable_driver: string;
};

type ThrottleComparisonRow = {
  session_id: string;
  segment_id: string;
  driver_a: string;
  driver_b: string;
  throttle_pickup_delta_m: Numeric;
  full_throttle_exit_delta_m: Numeric;
  traction_exit_delta: Numeric;
  confidence: Numeric;
  favorable_driver: string;
};

type StraightComparisonRow = {
  session_id: string;
  segment_id: string;
  driver_a: string;
  driver_b: string;
  entry_speed_delta_kph: Numeric;
  terminal_speed_delta_kph: Numeric;
  acceleration_delta: Numeric;
  drs_active_delta_pct: Numeric;
  clipping_proxy_delta: Numeric;
  confidence: Numeric;
  favorable_driver: string;
};

type EnergyProxyComparisonRow = {
  session_id: string;
  segment_id: string;
  driver_a: string;
  driver_b: string;
  deployment_proxy_delta: Numeric;
  lift_and_coast_delta: Numeric;
  clipping_proxy_delta: Numeric;
  recovery_zone_delta: Numeric;
  confidence: Numeric;
  proxy_note: string;
};

export type AnalyticsSessionSummary = {
  id: string;
  season: number;
  round: number;
  event: string;
  session: string;
  driverCount: number;
  segmentCount: number;
  straightCount: number;
  telemetryQualityMean: number | null;
  trackArchetype: string;
  generatedAt: string | null;
  buildVersion: string | null;
};

export type AnalyticsDriverOption = {
  code: string;
  team: string | null;
};

export type AnalyticsTrackSummary = {
  sessionId: string;
  trackArchetype: string;
  straightLineWeight: number | null;
  brakingWeight: number | null;
  tractionWeight: number | null;
  degradationWeight: number | null;
  trackPositionWeight: number | null;
  archetypeConfidence: number | null;
};

export type AnalyticsComparisonOverview = {
  sessionId: string;
  driverA: string;
  driverB: string;
  driverATeam: string | null;
  driverBTeam: string | null;
  segmentAdvantageCountA: number;
  segmentAdvantageCountB: number;
  straightAdvantageCountA: number;
  straightAdvantageCountB: number;
  avgSegmentDeltaKph: number | null;
  avgStraightDeltaKph: number | null;
  brakingAdvantageScore: number | null;
  tractionAdvantageScore: number | null;
  energyDeploymentProxyDelta: number | null;
  confidence: number | null;
  weakestAssumption: string;
  strategyRelevanceNote: string;
};

export type AnalyticsSegmentHighlight = {
  segmentId: string;
  segmentKind: string;
  segmentConfidence: number | null;
  entrySpeedDeltaKph: number | null;
  apexSpeedDeltaKph: number | null;
  exitSpeedDeltaKph: number | null;
  minSpeedDeltaKph: number | null;
  fasterDriver: string | null;
  confidence: number | null;
};

export type AnalyticsBrakingHighlight = {
  segmentId: string;
  brakingStartDeltaM: number | null;
  brakingDurationDeltaS: number | null;
  brakingDistanceDeltaM: number | null;
  lateBrakeDelta: number | null;
  brakeIntensityDelta: number | null;
  favorableDriver: string | null;
  confidence: number | null;
};

export type AnalyticsThrottleHighlight = {
  segmentId: string;
  throttlePickupDeltaM: number | null;
  fullThrottleExitDeltaM: number | null;
  tractionExitDelta: number | null;
  favorableDriver: string | null;
  confidence: number | null;
};

export type AnalyticsStraightHighlight = {
  segmentId: string;
  entrySpeedDeltaKph: number | null;
  terminalSpeedDeltaKph: number | null;
  accelerationDelta: number | null;
  drsActiveDeltaPct: number | null;
  clippingProxyDelta: number | null;
  favorableDriver: string | null;
  confidence: number | null;
};

export type AnalyticsEnergyProxyHighlight = {
  segmentId: string;
  deploymentProxyDelta: number | null;
  liftAndCoastDelta: number | null;
  clippingProxyDelta: number | null;
  recoveryZoneDelta: number | null;
  confidence: number | null;
  proxyNote: string;
};

export type AnalyticsCompareMode = "overview" | "segments" | "braking" | "throttle" | "straights" | "energy-proxy" | "all";

export type AnalyticsComparisonPayload = {
  session: AnalyticsSessionSummary;
  drivers: {
    a: AnalyticsDriverOption;
    b: AnalyticsDriverOption;
  };
  overview: AnalyticsComparisonOverview;
  primaryInsight: string;
  dataStrengthLabel: string;
  trackSummary: AnalyticsTrackSummary | null;
  segmentHighlights: AnalyticsSegmentHighlight[];
  brakingHighlights: AnalyticsBrakingHighlight[];
  throttleHighlights: AnalyticsThrottleHighlight[];
  straightHighlights: AnalyticsStraightHighlight[];
  energyProxyHighlights: AnalyticsEnergyProxyHighlight[];
  proxyNote: string;
  runtime: RuntimeSourceMetadata;
  detailMode: AnalyticsCompareMode;
  rowCaps: {
    segments: number;
    braking: number;
    throttle: number;
    straights: number;
    energyProxy: number;
  };
};

export type AnalyticsCompareValidation =
  | {
      ok: true;
      value: {
        sessionId: string;
        driverA: string;
        driverB: string;
        mode: AnalyticsCompareMode;
      };
    }
  | {
      ok: false;
      status: 400;
      code: "bad_request" | "validation_error";
      message: string;
    };

export type AnalyticsSessionListResult = RuntimeSourceResult<AnalyticsSessionSummary[]>;
export type AnalyticsDriversResult = RuntimeSourceResult<AnalyticsDriverOption[]>;
export type AnalyticsComparisonResult = RuntimeSourceResult<AnalyticsComparisonPayload>;
export type AnalyticsDriverPair = {
  driverA: string;
  driverB: string;
};

export const ANALYTICS_ENERGY_PROXY_NOTE = "Energy deployment is a telemetry-derived proxy, not true ERS or battery state.";
export const ANALYTICS_DETAIL_ROW_CAP = 10;
export const ANALYTICS_COMPARE_MODES = ["overview", "segments", "braking", "throttle", "straights", "energy-proxy", "all"] as const satisfies readonly AnalyticsCompareMode[];
const ANALYTICS_SESSION_PRIORITY: Record<string, number> = {
  R: 7,
  Q: 6,
  SQ: 5,
  S: 4,
  FP3: 3,
  FP2: 2,
  FP1: 1,
};

const readSessionRows = cache(async () => readCsvFile<SessionIndexRow>("analytics.sessionIndex"));
function getAnalyticsIndexedDir() {
  if (process.env.NODE_ENV === "test" || process.env.npm_lifecycle_event === "test") {
    const configuredTestRoot = process.env.F1_INSIGHTX_TEST_DATA_ROOT;
    const testRoot = configuredTestRoot
      ? path.resolve(/*turbopackIgnore: true*/ process.cwd(), configuredTestRoot)
      : path.join(/*turbopackIgnore: true*/ process.cwd(), "test-fixtures", "data");
    return path.join(testRoot, "analytics", "indexed");
  }

  return path.join(/*turbopackIgnore: true*/ process.cwd(), "..", "..", "data", "analytics", "indexed");
}

const gunzipAsync = promisify(gunzip);

type AnalyticsIndexedManifest = {
  version: number;
  row_cap: number;
  sessions: Record<string, {
    file: string;
    season: number;
    round: number;
    event: string;
    session: string;
    counts: Record<string, number>;
  }>;
};

type AnalyticsIndexedSessionPayload = {
  session: SessionIndexRow;
  drivers: AnalyticsDriverOption[];
  overview: DriverComparisonRow[];
  track_summary: TrackSummaryRow[];
  segments: SegmentComparisonRow[];
  braking: BrakingComparisonRow[];
  throttle: ThrottleComparisonRow[];
  straights: StraightComparisonRow[];
  energy_proxy: EnergyProxyComparisonRow[];
};

const readIndexedManifest = cache(async (): Promise<AnalyticsIndexedManifest> => {
  const filePath = path.join(getAnalyticsIndexedDir(), "analytics_session_manifest.json");
  const content = await readFile(filePath, "utf-8");
  return JSON.parse(content) as AnalyticsIndexedManifest;
});

const readIndexedSessionPayload = cache(async (sessionId: string): Promise<AnalyticsIndexedSessionPayload | null> => {
  const manifest = await readIndexedManifest();
  const entry = manifest.sessions[sessionId];
  if (!entry?.file || entry.file.includes("..") || path.isAbsolute(entry.file)) {
    return null;
  }

  try {
    const filePath = path.join(getAnalyticsIndexedDir(), "sessions", entry.file);
    const content = entry.file.endsWith(".gz")
      ? (await gunzipAsync(await readFile(filePath))).toString("utf-8")
      : await readFile(filePath, "utf-8");
    return JSON.parse(content) as AnalyticsIndexedSessionPayload;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
});

function clamp01(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  return Math.min(1, Math.max(0, value));
}

function asNumber(value: Numeric) {
  return parseNumber(value === undefined || value === null ? undefined : String(value));
}

function asCount(value: Numeric) {
  return Math.max(0, Math.trunc(asNumber(value) ?? 0));
}

function invertNumber(value: number | null) {
  return value === null ? null : -value;
}

function normalizedCode(value: string) {
  return value.trim().toUpperCase();
}

function pairKey(sessionId: string, driverA: string, driverB: string) {
  const [left, right] = [normalizedCode(driverA), normalizedCode(driverB)].sort();
  return `${sessionId}::${left}::${right}`;
}

function rowPairKey(row: { session_id: string; driver_a: string; driver_b: string }) {
  return pairKey(row.session_id, row.driver_a, row.driver_b);
}

function isRequestedOrder(row: { driver_a: string; driver_b: string }, driverA: string, driverB: string) {
  return normalizedCode(row.driver_a) === normalizedCode(driverA) && normalizedCode(row.driver_b) === normalizedCode(driverB);
}

function orientDriver(row: DriverComparisonRow, driverA: string, driverB: string): AnalyticsComparisonOverview {
  const sameOrder = isRequestedOrder(row, driverA, driverB);
  const avgSegmentDelta = asNumber(row.avg_segment_delta_kph);
  const avgStraightDelta = asNumber(row.avg_straight_delta_kph);
  const brakingScore = asNumber(row.braking_advantage_score);
  const tractionScore = asNumber(row.traction_advantage_score);
  const energyDelta = asNumber(row.energy_proxy_delta);

  return {
    sessionId: row.session_id,
    driverA: normalizedCode(driverA),
    driverB: normalizedCode(driverB),
    driverATeam: sameOrder ? row.driver_a_team || null : row.driver_b_team || null,
    driverBTeam: sameOrder ? row.driver_b_team || null : row.driver_a_team || null,
    segmentAdvantageCountA: sameOrder ? asCount(row.corner_advantage_count_a) : asCount(row.corner_advantage_count_b),
    segmentAdvantageCountB: sameOrder ? asCount(row.corner_advantage_count_b) : asCount(row.corner_advantage_count_a),
    straightAdvantageCountA: sameOrder ? asCount(row.straight_advantage_count_a) : asCount(row.straight_advantage_count_b),
    straightAdvantageCountB: sameOrder ? asCount(row.straight_advantage_count_b) : asCount(row.straight_advantage_count_a),
    avgSegmentDeltaKph: sameOrder ? avgSegmentDelta : invertNumber(avgSegmentDelta),
    avgStraightDeltaKph: sameOrder ? avgStraightDelta : invertNumber(avgStraightDelta),
    brakingAdvantageScore: sameOrder ? brakingScore : invertNumber(brakingScore),
    tractionAdvantageScore: sameOrder ? tractionScore : invertNumber(tractionScore),
    energyDeploymentProxyDelta: sameOrder ? energyDelta : invertNumber(energyDelta),
    confidence: clamp01(asNumber(row.confidence)),
    weakestAssumption: row.weakest_assumption || "Approximate segment IDs from precomputed telemetry features.",
    strategyRelevanceNote: row.strategy_relevance_note || "Use this as a product-level comparison, not a raw telemetry trace.",
  };
}

function orientSegment(row: SegmentComparisonRow, driverA: string, driverB: string): AnalyticsSegmentHighlight {
  const sameOrder = isRequestedOrder(row, driverA, driverB);
  const flip = (value: Numeric) => sameOrder ? asNumber(value) : invertNumber(asNumber(value));

  return {
    segmentId: row.segment_id,
    segmentKind: row.segment_kind || "approximate segment",
    segmentConfidence: clamp01(asNumber(row.segment_confidence)),
    entrySpeedDeltaKph: flip(row.entry_speed_delta_kph),
    apexSpeedDeltaKph: flip(row.apex_speed_delta_kph),
    exitSpeedDeltaKph: flip(row.exit_speed_delta_kph),
    minSpeedDeltaKph: flip(row.min_speed_delta_kph),
    fasterDriver: row.faster_driver || null,
    confidence: clamp01(asNumber(row.confidence)),
  };
}

function orientBraking(row: BrakingComparisonRow, driverA: string, driverB: string): AnalyticsBrakingHighlight {
  const sameOrder = isRequestedOrder(row, driverA, driverB);
  const flip = (value: Numeric) => sameOrder ? asNumber(value) : invertNumber(asNumber(value));

  return {
    segmentId: row.segment_id,
    brakingStartDeltaM: flip(row.braking_start_delta_m),
    brakingDurationDeltaS: flip(row.braking_duration_delta_s),
    brakingDistanceDeltaM: flip(row.braking_distance_delta_m),
    lateBrakeDelta: flip(row.late_brake_delta),
    brakeIntensityDelta: flip(row.brake_intensity_delta),
    favorableDriver: row.favorable_driver || null,
    confidence: clamp01(asNumber(row.confidence)),
  };
}

function orientThrottle(row: ThrottleComparisonRow, driverA: string, driverB: string): AnalyticsThrottleHighlight {
  const sameOrder = isRequestedOrder(row, driverA, driverB);
  const flip = (value: Numeric) => sameOrder ? asNumber(value) : invertNumber(asNumber(value));

  return {
    segmentId: row.segment_id,
    throttlePickupDeltaM: flip(row.throttle_pickup_delta_m),
    fullThrottleExitDeltaM: flip(row.full_throttle_exit_delta_m),
    tractionExitDelta: flip(row.traction_exit_delta),
    favorableDriver: row.favorable_driver || null,
    confidence: clamp01(asNumber(row.confidence)),
  };
}

function orientStraight(row: StraightComparisonRow, driverA: string, driverB: string): AnalyticsStraightHighlight {
  const sameOrder = isRequestedOrder(row, driverA, driverB);
  const flip = (value: Numeric) => sameOrder ? asNumber(value) : invertNumber(asNumber(value));

  return {
    segmentId: row.segment_id,
    entrySpeedDeltaKph: flip(row.entry_speed_delta_kph),
    terminalSpeedDeltaKph: flip(row.terminal_speed_delta_kph),
    accelerationDelta: flip(row.acceleration_delta),
    drsActiveDeltaPct: flip(row.drs_active_delta_pct),
    clippingProxyDelta: flip(row.clipping_proxy_delta),
    favorableDriver: row.favorable_driver || null,
    confidence: clamp01(asNumber(row.confidence)),
  };
}

function orientEnergyProxy(row: EnergyProxyComparisonRow, driverA: string, driverB: string): AnalyticsEnergyProxyHighlight {
  const sameOrder = isRequestedOrder(row, driverA, driverB);
  const flip = (value: Numeric) => sameOrder ? asNumber(value) : invertNumber(asNumber(value));
  const proxyNote = row.proxy_note?.toLowerCase().includes("proxy") ? row.proxy_note : ANALYTICS_ENERGY_PROXY_NOTE;

  return {
    segmentId: row.segment_id,
    deploymentProxyDelta: flip(row.deployment_proxy_delta),
    liftAndCoastDelta: flip(row.lift_and_coast_delta),
    clippingProxyDelta: flip(row.clipping_proxy_delta),
    recoveryZoneDelta: flip(row.recovery_zone_delta),
    confidence: clamp01(asNumber(row.confidence)),
    proxyNote,
  };
}

function mapSession(row: SessionIndexRow): AnalyticsSessionSummary {
  return {
    id: row.session_id,
    season: asCount(row.season),
    round: asCount(row.round),
    event: row.event,
    session: row.session,
    driverCount: asCount(row.driver_count),
    segmentCount: asCount(row.segment_count),
    straightCount: asCount(row.straight_count),
    telemetryQualityMean: clamp01(asNumber(row.telemetry_quality_mean)),
    trackArchetype: row.track_archetype || "mixed",
    generatedAt: row.generated_at || null,
    buildVersion: row.build_version || null,
  };
}

function mapTrackSummary(row: TrackSummaryRow): AnalyticsTrackSummary {
  return {
    sessionId: row.session_id,
    trackArchetype: row.track_archetype || "mixed",
    straightLineWeight: clamp01(asNumber(row.straight_line_weight)),
    brakingWeight: clamp01(asNumber(row.braking_weight)),
    tractionWeight: clamp01(asNumber(row.traction_weight)),
    degradationWeight: clamp01(asNumber(row.degradation_weight)),
    trackPositionWeight: clamp01(asNumber(row.track_position_weight)),
    archetypeConfidence: clamp01(asNumber(row.archetype_confidence)),
  };
}

function describeSessions(sessions: AnalyticsSessionSummary[]) {
  const latest = sessions[0] ?? null;

  return {
    eventId: latest?.id ?? null,
    season: latest?.season ?? null,
    round: latest?.round ?? null,
    generatedAt: latest?.generatedAt ?? null,
    buildVersion: latest?.buildVersion ?? null,
  };
}

function describeComparison(comparison: AnalyticsComparisonPayload) {
  return {
    eventId: comparison.session.id,
    season: comparison.session.season,
    round: comparison.session.round,
    generatedAt: comparison.session.generatedAt,
    buildVersion: comparison.session.buildVersion,
  };
}

function dataStrengthLabel(confidence: number | null, telemetryQuality: number | null) {
  const score = Math.min(confidence ?? 0, telemetryQuality ?? 0);
  if (score >= 0.86) return "Strong telemetry agreement";
  if (score >= 0.68) return "Moderate telemetry confidence";
  if (score >= 0.45) return "Traffic-adjusted inference";
  if (score > 0) return "Limited clean-lap data";
  return "Incomplete session confidence";
}

function signedLeader(value: number | null, driverA: string, driverB: string) {
  if (value === null || Math.abs(value) < 0.0001) {
    return "Even";
  }

  return value > 0 ? driverA : driverB;
}

function buildPrimaryInsight(overview: AnalyticsComparisonOverview, track: AnalyticsTrackSummary | null) {
  const archetype = track?.trackArchetype ?? "mixed";
  const straightDriver = overview.straightAdvantageCountA === overview.straightAdvantageCountB
    ? signedLeader(overview.avgStraightDeltaKph, overview.driverA, overview.driverB)
    : overview.straightAdvantageCountA > overview.straightAdvantageCountB ? overview.driverA : overview.driverB;
  const segmentDriver = overview.segmentAdvantageCountA === overview.segmentAdvantageCountB
    ? signedLeader(overview.avgSegmentDeltaKph, overview.driverA, overview.driverB)
    : overview.segmentAdvantageCountA > overview.segmentAdvantageCountB ? overview.driverA : overview.driverB;
  const tractionDriver = signedLeader(overview.tractionAdvantageScore, overview.driverA, overview.driverB);
  const energyDriver = signedLeader(overview.energyDeploymentProxyDelta, overview.driverA, overview.driverB);

  if (archetype.includes("power") && straightDriver !== "Even") {
    return `${straightDriver} carries the clearer straight-line edge on this ${archetype} session.`;
  }

  if (archetype.includes("traction") && tractionDriver !== "Even") {
    return `${tractionDriver} has the stronger exit-traction signal for this ${archetype} session.`;
  }

  if (energyDriver !== "Even") {
    return `${energyDriver} has the stronger energy deployment proxy signal; treat it as proxy evidence only.`;
  }

  if (segmentDriver !== "Even") {
    return `${segmentDriver} leads more approximate segments, but confidence should be read with the segment-quality note.`;
  }

  return "The comparison is closely matched across the prepared telemetry signals.";
}

function defaultPairScore(row: DriverComparisonRow) {
  return (
    (asNumber(row.confidence) ?? 0) * 2
    + Math.min(1, Math.abs(asNumber(row.avg_segment_delta_kph) ?? 0) / 8)
    + Math.min(1, Math.abs(asNumber(row.avg_straight_delta_kph) ?? 0) / 10)
    + Math.min(1, Math.abs(asNumber(row.braking_advantage_score) ?? 0) / 0.15)
    + Math.min(1, Math.abs(asNumber(row.traction_advantage_score) ?? 0) / 0.15)
  );
}

function isCompareMode(value: string | null | undefined): value is AnalyticsCompareMode {
  return ANALYTICS_COMPARE_MODES.includes(value as AnalyticsCompareMode);
}

function topByMagnitude<T>(rows: T[], score: (row: T) => number) {
  return rows
    .slice()
    .sort((left, right) => Math.abs(score(right)) - Math.abs(score(left)))
    .slice(0, ANALYTICS_DETAIL_ROW_CAP);
}

function matchPair<T extends { session_id: string; driver_a: string; driver_b: string }>(sessionId: string, driverA: string, driverB: string) {
  const targetKey = pairKey(sessionId, driverA, driverB);
  return (row: T) => rowPairKey(row) === targetKey;
}

function loadSegmentHighlights(rows: SegmentComparisonRow[], sessionId: string, driverA: string, driverB: string) {
  return topByMagnitude(
    rows.filter(matchPair(sessionId, driverA, driverB)).map((row) => orientSegment(row, driverA, driverB)),
    (row) => Math.max(Math.abs(row.apexSpeedDeltaKph ?? 0), Math.abs(row.exitSpeedDeltaKph ?? 0), Math.abs(row.entrySpeedDeltaKph ?? 0)),
  );
}

function loadBrakingHighlights(rows: BrakingComparisonRow[], sessionId: string, driverA: string, driverB: string) {
  return topByMagnitude(
    rows.filter(matchPair(sessionId, driverA, driverB)).map((row) => orientBraking(row, driverA, driverB)),
    (row) => Math.max(Math.abs(row.lateBrakeDelta ?? 0), Math.abs(row.brakeIntensityDelta ?? 0), Math.abs(row.brakingDistanceDeltaM ?? 0)),
  );
}

function loadThrottleHighlights(rows: ThrottleComparisonRow[], sessionId: string, driverA: string, driverB: string) {
  return topByMagnitude(
    rows.filter(matchPair(sessionId, driverA, driverB)).map((row) => orientThrottle(row, driverA, driverB)),
    (row) => Math.max(Math.abs(row.tractionExitDelta ?? 0), Math.abs(row.throttlePickupDeltaM ?? 0)),
  );
}

function loadStraightHighlights(rows: StraightComparisonRow[], sessionId: string, driverA: string, driverB: string) {
  return topByMagnitude(
    rows.filter(matchPair(sessionId, driverA, driverB)).map((row) => orientStraight(row, driverA, driverB)),
    (row) => Math.max(Math.abs(row.terminalSpeedDeltaKph ?? 0), Math.abs(row.accelerationDelta ?? 0)),
  );
}

function loadEnergyProxyHighlights(rows: EnergyProxyComparisonRow[], sessionId: string, driverA: string, driverB: string) {
  return topByMagnitude(
    rows.filter(matchPair(sessionId, driverA, driverB)).map((row) => orientEnergyProxy(row, driverA, driverB)),
    (row) => Math.max(Math.abs(row.deploymentProxyDelta ?? 0), Math.abs(row.clippingProxyDelta ?? 0)),
  );
}

async function listFromCsv(): Promise<AnalyticsSessionSummary[]> {
  const rows = await readSessionRows();
  return rows
    .map(mapSession)
    .sort((left, right) => (right.season - left.season) || (right.round - left.round) || ((ANALYTICS_SESSION_PRIORITY[right.session] ?? 0) - (ANALYTICS_SESSION_PRIORITY[left.session] ?? 0)));
}

async function driversFromCsv(sessionId: string): Promise<AnalyticsDriverOption[]> {
  const payload = await readIndexedSessionPayload(sessionId);
  return (payload?.drivers ?? []).map((driver) => ({
    code: normalizedCode(driver.code),
    team: driver.team || null,
  })).sort((left, right) => left.code.localeCompare(right.code));
}

async function comparisonFromCsv(sessionId: string, driverA: string, driverB: string, mode: AnalyticsCompareMode): Promise<AnalyticsComparisonPayload | null> {
  const [sessions, payload] = await Promise.all([
    listFromCsv(),
    readIndexedSessionPayload(sessionId),
  ]);
  const session = sessions.find((item) => item.id === sessionId) ?? null;
  if (!session || !payload) return null;

  const requestedA = normalizedCode(driverA);
  const requestedB = normalizedCode(driverB);
  const drivers = payload.drivers.map((driver) => ({ code: normalizedCode(driver.code), team: driver.team || null }));
  const driverMap = new Map(drivers.map((driver) => [driver.code, driver]));
  const driverOptionA = driverMap.get(requestedA);
  const driverOptionB = driverMap.get(requestedB);
  if (!driverOptionA || !driverOptionB) return null;

  const targetKey = pairKey(sessionId, requestedA, requestedB);
  const driverRow = payload.overview.find((row) => rowPairKey(row) === targetKey);
  if (!driverRow) return null;

  const overview = orientDriver(driverRow, requestedA, requestedB);
  const trackSummary = payload.track_summary.find((row) => row.session_id === sessionId);
  const mappedTrackSummary = trackSummary ? mapTrackSummary(trackSummary) : null;

  const runtime: RuntimeSourceMetadata = {
    surface: "analytics",
    mode: "primary",
    sourceKind: "csv-product",
    sourceLabel: "analytics_csv_product_views",
    reason: null,
    generatedAt: session.generatedAt,
    buildVersion: session.buildVersion,
    eventId: session.id,
    season: session.season,
    round: session.round,
  };
  const segmentHighlights = mode === "segments" || mode === "all" ? loadSegmentHighlights(payload.segments, sessionId, requestedA, requestedB) : [];
  const brakingHighlights = mode === "braking" || mode === "all" ? loadBrakingHighlights(payload.braking, sessionId, requestedA, requestedB) : [];
  const throttleHighlights = mode === "throttle" || mode === "all" ? loadThrottleHighlights(payload.throttle, sessionId, requestedA, requestedB) : [];
  const straightHighlights = mode === "straights" || mode === "all" ? loadStraightHighlights(payload.straights, sessionId, requestedA, requestedB) : [];
  const energyProxyHighlights = mode === "energy-proxy" || mode === "all" ? loadEnergyProxyHighlights(payload.energy_proxy, sessionId, requestedA, requestedB) : [];

  return {
    session,
    drivers: {
      a: driverOptionA,
      b: driverOptionB,
    },
    overview,
    primaryInsight: buildPrimaryInsight(overview, mappedTrackSummary),
    dataStrengthLabel: dataStrengthLabel(overview.confidence, session.telemetryQualityMean),
    trackSummary: mappedTrackSummary,
    segmentHighlights,
    brakingHighlights,
    throttleHighlights,
    straightHighlights,
    energyProxyHighlights,
    proxyNote: energyProxyHighlights[0]?.proxyNote ?? ANALYTICS_ENERGY_PROXY_NOTE,
    runtime,
    detailMode: mode,
    rowCaps: {
      segments: ANALYTICS_DETAIL_ROW_CAP,
      braking: ANALYTICS_DETAIL_ROW_CAP,
      throttle: ANALYTICS_DETAIL_ROW_CAP,
      straights: ANALYTICS_DETAIL_ROW_CAP,
      energyProxy: ANALYTICS_DETAIL_ROW_CAP,
    },
  };
}

export function validateAnalyticsCompareParams(input: {
  sessionId?: string | null;
  driverA?: string | null;
  driverB?: string | null;
  mode?: string | null;
}): AnalyticsCompareValidation {
  const sessionId = input.sessionId?.trim();
  const driverA = input.driverA?.trim();
  const driverB = input.driverB?.trim();

  if (!sessionId || !driverA || !driverB) {
    return {
      ok: false,
      status: 400,
      code: "bad_request",
      message: "sessionId, driverA, and driverB are required.",
    };
  }

  if (normalizedCode(driverA) === normalizedCode(driverB)) {
    return {
      ok: false,
      status: 400,
      code: "validation_error",
      message: "Choose two different drivers for an Analytics comparison.",
    };
  }
  const mode = input.mode?.trim() || "overview";
  if (!isCompareMode(mode)) {
    return {
      ok: false,
      status: 400,
      code: "validation_error",
      message: "Choose a valid Analytics comparison mode.",
    };
  }

  return {
    ok: true,
    value: {
      sessionId,
      driverA: normalizedCode(driverA),
      driverB: normalizedCode(driverB),
      mode,
    },
  };
}

export function getAnalyticsDriverPairKey(sessionId: string, driverA: string, driverB: string) {
  return pairKey(sessionId, driverA, driverB);
}

export const listAnalyticsSessionsResult = cache(async (): Promise<AnalyticsSessionListResult> =>
  resolveRuntimeSource({
    surface: "analytics",
    primary: {
      sourceKind: "csv-product",
      sourceLabel: "analytics_csv_product_views",
      load: async () => {
        const sessions = await listFromCsv();
        return sessions.length > 0 ? sessions : null;
      },
      describe: describeSessions,
    },
  }),
);

export const listAnalyticsSessions = cache(async (): Promise<AnalyticsSessionSummary[]> => {
  const result = await listAnalyticsSessionsResult();
  return getRuntimeData(result) ?? [];
});

export const getAnalyticsDriversResult = cache(async (sessionId: string): Promise<AnalyticsDriversResult> =>
  resolveRuntimeSource({
    surface: "analytics",
    primary: {
      sourceKind: "csv-product",
      sourceLabel: "analytics_csv_product_views",
      load: async () => {
        const sessions = await listFromCsv();
        if (!sessions.some((session) => session.id === sessionId)) {
          return null;
        }

        const drivers = await driversFromCsv(sessionId);
        return drivers.length > 0 ? drivers : null;
      },
      describe: () => ({ eventId: sessionId }),
    },
  }),
);

export const getAnalyticsDrivers = cache(async (sessionId: string): Promise<AnalyticsDriverOption[]> => {
  const result = await getAnalyticsDriversResult(sessionId);
  return getRuntimeData(result) ?? [];
});

export const getAnalyticsDefaultDriverPair = cache(async (sessionId: string): Promise<AnalyticsDriverPair | null> => {
  const payload = await readIndexedSessionPayload(sessionId);
  const bestRow = payload?.overview
    ?.filter((row) => normalizedCode(row.driver_a) !== normalizedCode(row.driver_b))
    .sort((left, right) => defaultPairScore(right) - defaultPairScore(left))[0];

  if (!bestRow) {
    return null;
  }

  return {
    driverA: normalizedCode(bestRow.driver_a),
    driverB: normalizedCode(bestRow.driver_b),
  };
});

export const getAnalyticsComparisonResult = cache(async (sessionId: string, driverA: string, driverB: string, mode: AnalyticsCompareMode = "overview"): Promise<AnalyticsComparisonResult> =>
  resolveRuntimeSource({
    surface: "analytics",
    primary: {
      sourceKind: "csv-product",
      sourceLabel: "analytics_csv_product_views",
      load: () => comparisonFromCsv(sessionId, driverA, driverB, mode),
      describe: describeComparison,
    },
  }),
);

export const getAnalyticsComparison = cache(async (sessionId: string, driverA: string, driverB: string, mode: AnalyticsCompareMode = "overview"): Promise<AnalyticsComparisonPayload | null> => {
  const result = await getAnalyticsComparisonResult(sessionId, driverA, driverB, mode);
  return getRuntimeData(result);
});
