import { cache } from "react";
import { parseNumber, readDataCsv } from "@/lib/server/csv";
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
};

export type AnalyticsCompareValidation =
  | {
      ok: true;
      value: {
        sessionId: string;
        driverA: string;
        driverB: string;
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

export const ANALYTICS_ENERGY_PROXY_NOTE = "Energy deployment is a telemetry-derived proxy, not true ERS or battery state.";

const readSessionRows = cache(async () => readDataCsv("analytics", "analytics_session_index.csv") as Promise<SessionIndexRow[]>);
const readDriverComparisonRows = cache(async () => readDataCsv("analytics", "analytics_driver_comparison.csv") as Promise<DriverComparisonRow[]>);
const readTrackSummaryRows = cache(async () => readDataCsv("analytics", "analytics_track_summary.csv") as Promise<TrackSummaryRow[]>);

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
  if (score >= 0.82) return "High data strength";
  if (score >= 0.62) return "Medium data strength";
  return "Limited data strength";
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

  return "The comparison is closely matched across the precomputed telemetry product views.";
}

async function listFromCsv(): Promise<AnalyticsSessionSummary[]> {
  const rows = await readSessionRows();
  return rows
    .map(mapSession)
    .sort((left, right) => (right.season - left.season) || (right.round - left.round) || left.session.localeCompare(right.session));
}

async function driversFromCsv(sessionId: string): Promise<AnalyticsDriverOption[]> {
  const rows = (await readDriverComparisonRows()).filter((row) => row.session_id === sessionId);
  const drivers = new Map<string, AnalyticsDriverOption>();

  for (const row of rows) {
    drivers.set(normalizedCode(row.driver_a), { code: normalizedCode(row.driver_a), team: row.driver_a_team || null });
    drivers.set(normalizedCode(row.driver_b), { code: normalizedCode(row.driver_b), team: row.driver_b_team || null });
  }

  return Array.from(drivers.values()).sort((left, right) => left.code.localeCompare(right.code));
}

async function comparisonFromCsv(sessionId: string, driverA: string, driverB: string): Promise<AnalyticsComparisonPayload | null> {
  const [sessions, drivers, driverRows, trackRows] = await Promise.all([
    listFromCsv(),
    driversFromCsv(sessionId),
    readDriverComparisonRows(),
    readTrackSummaryRows(),
  ]);
  const session = sessions.find((item) => item.id === sessionId) ?? null;
  if (!session) return null;

  const requestedA = normalizedCode(driverA);
  const requestedB = normalizedCode(driverB);
  const driverMap = new Map(drivers.map((driver) => [driver.code, driver]));
  const driverOptionA = driverMap.get(requestedA);
  const driverOptionB = driverMap.get(requestedB);
  if (!driverOptionA || !driverOptionB) return null;

  const targetKey = pairKey(sessionId, requestedA, requestedB);
  const driverRow = driverRows.find((row) => rowPairKey(row) === targetKey);
  if (!driverRow) return null;

  const overview = orientDriver(driverRow, requestedA, requestedB);
  const trackSummary = trackRows.find((row) => row.session_id === sessionId);
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
    segmentHighlights: [],
    brakingHighlights: [],
    throttleHighlights: [],
    straightHighlights: [],
    energyProxyHighlights: [],
    proxyNote: ANALYTICS_ENERGY_PROXY_NOTE,
    runtime,
  };
}

export function validateAnalyticsCompareParams(input: {
  sessionId?: string | null;
  driverA?: string | null;
  driverB?: string | null;
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

  return {
    ok: true,
    value: {
      sessionId,
      driverA: normalizedCode(driverA),
      driverB: normalizedCode(driverB),
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

export const getAnalyticsComparisonResult = cache(async (sessionId: string, driverA: string, driverB: string): Promise<AnalyticsComparisonResult> =>
  resolveRuntimeSource({
    surface: "analytics",
    primary: {
      sourceKind: "csv-product",
      sourceLabel: "analytics_csv_product_views",
      load: () => comparisonFromCsv(sessionId, driverA, driverB),
      describe: describeComparison,
    },
  }),
);

export const getAnalyticsComparison = cache(async (sessionId: string, driverA: string, driverB: string): Promise<AnalyticsComparisonPayload | null> => {
  const result = await getAnalyticsComparisonResult(sessionId, driverA, driverB);
  return getRuntimeData(result);
});
