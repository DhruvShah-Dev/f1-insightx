import traceManifestRaw from "../../data/analytics/indexed/traces/analytics_trace_manifest.json?raw";
import segmentMapRaw from "../../data/analytics/analytics_segment_map.csv?raw";
import { serverClient } from "./f1.server";
import {
  ENERGY_PROXY_NOTE,
  TELEMETRY_SESSIONS,
  approximateSegmentRange,
  clampConfidence,
  invertNullable,
  type TelemetryComparison,
  type TelemetryOverview,
  type TelemetrySegment,
  type TelemetrySessionCode,
  type TelemetryStraight,
  type TelemetryTrace,
  type TelemetryTrackSummary,
} from "./telemetry-comparison";

type Row = Record<string, unknown>;
type TraceManifest = {
  sessions: Record<
    string,
    {
      file: string;
      season: number;
      round: number;
      event: string;
      session: string;
      quality: number;
      source: string;
      tracePointCount: number;
    }
  >;
};
type TracePayload = {
  generatedAt?: string;
  source?: string;
  qualityTier?: string;
  honestyNote?: string;
  drivers?: Record<string, TelemetryTrace>;
};

const traceManifest = JSON.parse(traceManifestRaw) as TraceManifest;
const segmentMap = new Map(
  segmentMapRaw
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.split(","))
    .filter((columns) => columns.length >= 8)
    .map((columns) => [
      `${columns[0]}|${columns[1]}`,
      {
        start: Number(columns[5]),
        end: Number(columns[6]),
        apex: Number(columns[7]),
        confidence: Number(columns[8]),
      },
    ] as const),
);
const traceAssets = import.meta.glob<string>(
  "../../data/analytics/indexed/traces/*.json.gz",
  { eager: true, query: "?inline", import: "default" },
);
const SESSION_PRIORITY: Record<TelemetrySessionCode, number> = {
  R: 7,
  Q: 6,
  SQ: 5,
  S: 4,
  FP3: 3,
  FP2: 2,
  FP1: 1,
};
const DETAIL_CAP = 24;

const numberOrNull = (value: unknown) => {
  const number = value == null || value === "" ? null : Number(value);
  return number == null || !Number.isFinite(number) ? null : number;
};
const textOrNull = (value: unknown) => (value == null || value === "" ? null : String(value));
const code = (value: string) => value.trim().toUpperCase();

function isSessionCode(value: string): value is TelemetrySessionCode {
  return TELEMETRY_SESSIONS.includes(value as TelemetrySessionCode);
}

function pairMatches(row: Row, left: string, right: string) {
  const rowA = code(String(row["driver_a"] ?? ""));
  const rowB = code(String(row["driver_b"] ?? ""));
  return (rowA === left && rowB === right) || (rowA === right && rowB === left);
}

function requestedOrder(row: Row, driverA: string) {
  return code(String(row["driver_a"] ?? "")) === driverA;
}

function orientedDriver(row: Row, field: string, side: "a" | "b", sameOrder: boolean) {
  const requestedSide = sameOrder ? side : side === "a" ? "b" : "a";
  return numberOrNull(row[`${field}_${requestedSide}`]);
}

function favorableDriver(value: unknown, sameOrder: boolean, driverA: string, driverB: string) {
  const raw = code(String(value ?? ""));
  if (!raw) return null;
  if (sameOrder) return raw;
  if (raw === driverA) return driverA;
  if (raw === driverB) return driverB;
  return raw;
}

async function decodeTraceAsset(file: string): Promise<TracePayload | null> {
  const entry = Object.entries(traceAssets).find(([path]) => path.endsWith(`/${file}`));
  const source = entry?.[1];
  if (!source) return null;
  try {
    const base64 = source.includes(",") ? source.slice(source.indexOf(",") + 1) : source;
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    return JSON.parse(await new Response(stream).text()) as TracePayload;
  } catch {
    return null;
  }
}

async function loadTraces(sessionId: string, driverA: string, driverB: string) {
  const manifestEntry = traceManifest.sessions[sessionId];
  if (!manifestEntry) return { traces: [null, null] as [null, null], payload: null };
  const payload = await decodeTraceAsset(manifestEntry.file);
  const normalize = (trace: TelemetryTrace | undefined): TelemetryTrace | null => {
    if (!trace || !Array.isArray(trace.points)) return null;
    return {
      ...trace,
      quality: clampConfidence(trace.quality),
      points: trace.points.slice(0, 96).map((point) => ({
        x: Math.max(0, Math.min(1, Number(point.x) || 0)),
        speed: numberOrNull(point.speed),
        rpm: numberOrNull(point.rpm),
        gear: numberOrNull(point.gear),
        throttle: numberOrNull(point.throttle),
        brake: numberOrNull(point.brake),
        drs: numberOrNull(point.drs),
        energyProxy: numberOrNull(point.energyProxy),
      })),
    };
  };
  return {
    traces: [normalize(payload?.drivers?.[driverA]), normalize(payload?.drivers?.[driverB])] as [
      TelemetryTrace | null,
      TelemetryTrace | null,
    ],
    payload,
  };
}

function manifestSessions(season: number, round: number) {
  return Object.entries(traceManifest.sessions)
    .filter(([, entry]) => entry.season === season && entry.round === round && isSessionCode(entry.session))
    .map(([id, entry]) => ({
      id,
      session_id: id,
      season,
      round,
      session: entry.session as TelemetrySessionCode,
      event: entry.event,
      generated_at: null,
      telemetry_quality_mean: entry.quality,
      track_archetype: "mixed",
    }));
}

function sessionList(rows: Row[], season: number, round: number) {
  const seen = new Set<TelemetrySessionCode>();
  return rows
    .filter(
      (row) =>
        Number(row["season"]) === season &&
        Number(row["round"]) === round &&
        isSessionCode(String(row["session"] ?? "")),
    )
    .map((row) => String(row["session"]) as TelemetrySessionCode)
    .filter((session) => (seen.has(session) ? false : (seen.add(session), true)))
    .sort((a, b) => SESSION_PRIORITY[b] - SESSION_PRIORITY[a]);
}

export async function fetchTelemetryComparison(input: {
  season: number;
  round: number;
  event: string;
  resultsOnly: boolean;
  session: TelemetrySessionCode;
  a: string;
  b: string;
}): Promise<TelemetryComparison> {
  const driverA = code(input.a);
  const driverB = code(input.b);
  if (driverA === driverB) throw new Error("Select two different drivers.");

  let indexRows: Row[] = [];
  try {
    const { data } = await serverClient()
      .from("analytics_session_index")
      .select("*")
      .eq("season", input.season)
      .eq("round", input.round)
      .limit(12);
    indexRows = (data ?? []) as Row[];
  } catch {
    indexRows = [];
  }
  if (!indexRows.length) indexRows = manifestSessions(input.season, input.round) as Row[];

  const availableSessions = sessionList(indexRows, input.season, input.round);
  const selectedCode = availableSessions.includes(input.session)
    ? input.session
    : (availableSessions[0] ?? input.session);
  const selected = indexRows.find((row) => String(row["session"]) === selectedCode) ?? null;
  const sessionId = String(selected?.["session_id"] ?? selected?.["id"] ?? "");
  const baseSession = {
    id: sessionId || null,
    code: selectedCode,
    season: input.season,
    round: input.round,
    event: String(selected?.["event"] ?? input.event),
    generatedAt: textOrNull(selected?.["generated_at"]),
    source: "precomputed analytics product views",
  };

  if (!sessionId) {
    return {
      availability: input.resultsOnly ? "results-only" : "unavailable",
      availableSessions,
      session: baseSession,
      drivers: { a: driverA, b: driverB },
      quality: {
        confidence: null,
        traceQuality: null,
        label: "Telemetry unavailable",
        weakestAssumption: "No prepared analytics session exists for this weekend.",
      },
      overview: null,
      track: null,
      traces: [null, null],
      segments: [],
      straights: [],
      note: "No representative telemetry has been prepared for this session.",
      proxyNote: ENERGY_PROXY_NOTE,
    };
  }

  const left = driverA < driverB ? driverA : driverB;
  const right = driverA < driverB ? driverB : driverA;
  let sb: ReturnType<typeof serverClient>;
  try {
    sb = serverClient();
  } catch {
    const traceResult = await loadTraces(sessionId, driverA, driverB);
    const traceQuality = Math.min(...traceResult.traces.map((trace) => trace?.quality ?? 0));
    const hasBothTraces = traceResult.traces.every(Boolean);
    return {
      availability: hasBothTraces ? "partial" : input.resultsOnly ? "results-only" : "unavailable",
      availableSessions,
      session: {
        ...baseSession,
        generatedAt: traceResult.payload?.generatedAt ?? baseSession.generatedAt,
        source: traceResult.payload?.source ?? baseSession.source,
      },
      drivers: { a: driverA, b: driverB },
      quality: {
        confidence: null,
        traceQuality: traceQuality || null,
        label: hasBothTraces ? "Representative traces available" : "Telemetry unavailable",
        weakestAssumption: "Aggregate comparison tables are not configured in this runtime.",
      },
      overview: null,
      track: null,
      traces: traceResult.traces,
      segments: [],
      straights: [],
      note:
        traceResult.payload?.honestyNote ??
        "Precomputed representative telemetry trace. Aggregate comparison rows are unavailable.",
      proxyNote: ENERGY_PROXY_NOTE,
    };
  }
  const queryPair = (table: string, limit = DETAIL_CAP * 2) =>
    sb.from(table).select("*").eq("session_id", sessionId).eq("driver_a", left).eq("driver_b", right).limit(limit);
  const [overviewResult, segmentResult, brakingResult, throttleResult, straightResult, energyResult, trackResult, traceResult] =
    await Promise.all([
      queryPair("analytics_driver_comparison", 1),
      queryPair("analytics_segment_comparison", 240),
      queryPair("analytics_braking_comparison", 240),
      queryPair("analytics_throttle_comparison", 240),
      queryPair("analytics_straight_comparison", 120),
      queryPair("analytics_energy_proxy_comparison", 120),
      sb.from("analytics_track_summary").select("*").eq("session_id", sessionId).limit(1),
      loadTraces(sessionId, driverA, driverB),
    ]);

  const overviewRow = ((overviewResult.data ?? []) as Row[]).find((row) => pairMatches(row, left, right)) ?? null;
  const sameOrder = overviewRow ? requestedOrder(overviewRow, driverA) : driverA === left;
  const invert = !sameOrder;
  const overview: TelemetryOverview | null = overviewRow
    ? {
        segmentWinsA: Number(overviewRow[sameOrder ? "corner_advantage_count_a" : "corner_advantage_count_b"] ?? 0),
        segmentWinsB: Number(overviewRow[sameOrder ? "corner_advantage_count_b" : "corner_advantage_count_a"] ?? 0),
        straightWinsA: Number(overviewRow[sameOrder ? "straight_advantage_count_a" : "straight_advantage_count_b"] ?? 0),
        straightWinsB: Number(overviewRow[sameOrder ? "straight_advantage_count_b" : "straight_advantage_count_a"] ?? 0),
        avgSegmentDeltaKph: invertNullable(numberOrNull(overviewRow["avg_segment_delta_kph"]), invert),
        avgStraightDeltaKph: invertNullable(numberOrNull(overviewRow["avg_straight_delta_kph"]), invert),
        brakingAdvantage: invertNullable(numberOrNull(overviewRow["braking_advantage_score"]), invert),
        tractionAdvantage: invertNullable(numberOrNull(overviewRow["traction_advantage_score"]), invert),
        energyProxyDelta: invertNullable(numberOrNull(overviewRow["energy_proxy_delta"]), invert),
        strategyNote: String(overviewRow["strategy_relevance_note"] ?? "Compare the prepared telemetry signals in context."),
      }
    : null;

  const brakingBySegment = new Map(((brakingResult.data ?? []) as Row[]).map((row) => [String(row["segment_id"]), row]));
  const throttleBySegment = new Map(((throttleResult.data ?? []) as Row[]).map((row) => [String(row["segment_id"]), row]));
  const segmentRows = ((segmentResult.data ?? []) as Row[]).filter((row) => pairMatches(row, left, right)).slice(0, DETAIL_CAP);
  const segments: TelemetrySegment[] = segmentRows.map((row, index) => {
    const rowSameOrder = requestedOrder(row, driverA);
    const rowInvert = !rowSameOrder;
    const segmentId = String(row["segment_id"] ?? `segment_${index + 1}`);
    const braking = brakingBySegment.get(segmentId);
    const throttle = throttleBySegment.get(segmentId);
    const preparedRange = segmentMap.get(`${sessionId}|${segmentId}`);
    const range =
      preparedRange &&
      Number.isFinite(preparedRange.start) &&
      Number.isFinite(preparedRange.end) &&
      Number.isFinite(preparedRange.apex)
        ? preparedRange
        : approximateSegmentRange(segmentId, index, segmentRows.length);
    const cornerMatch = segmentId.match(/(?:corner|segment|turn)[_-]?(\d+)/i);
    return {
      segmentId,
      label: cornerMatch?.[1] ? `T${Number.parseInt(cornerMatch[1], 10)}` : `Z${index + 1}`,
      kind: String(row["segment_kind"] ?? "approximate segment"),
      normalizedStart: range.start,
      normalizedEnd: range.end,
      normalizedApex: range.apex,
      confidence: clampConfidence(preparedRange?.confidence ?? row["confidence"]),
      fasterDriver: favorableDriver(row["faster_driver"], rowSameOrder, driverA, driverB),
      entryDeltaKph: invertNullable(numberOrNull(row["entry_speed_delta_kph"]), rowInvert),
      apexDeltaKph: invertNullable(numberOrNull(row["apex_speed_delta_kph"]), rowInvert),
      exitDeltaKph: invertNullable(numberOrNull(row["exit_speed_delta_kph"]), rowInvert),
      minDeltaKph: invertNullable(numberOrNull(row["min_speed_delta_kph"]), rowInvert),
      entrySpeedA: orientedDriver(row, "entry_speed_kph", "a", rowSameOrder),
      entrySpeedB: orientedDriver(row, "entry_speed_kph", "b", rowSameOrder),
      apexSpeedA: orientedDriver(row, "apex_speed_kph", "a", rowSameOrder),
      apexSpeedB: orientedDriver(row, "apex_speed_kph", "b", rowSameOrder),
      exitSpeedA: orientedDriver(row, "exit_speed_kph", "a", rowSameOrder),
      exitSpeedB: orientedDriver(row, "exit_speed_kph", "b", rowSameOrder),
      entryGearA: orientedDriver(row, "entry_gear", "a", rowSameOrder),
      entryGearB: orientedDriver(row, "entry_gear", "b", rowSameOrder),
      apexGearA: orientedDriver(row, "apex_gear", "a", rowSameOrder),
      apexGearB: orientedDriver(row, "apex_gear", "b", rowSameOrder),
      exitGearA: orientedDriver(row, "exit_gear", "a", rowSameOrder),
      exitGearB: orientedDriver(row, "exit_gear", "b", rowSameOrder),
      brakingStartDeltaM: invertNullable(numberOrNull(braking?.["braking_start_delta_m"]), rowInvert),
      brakingDurationDeltaS: invertNullable(numberOrNull(braking?.["braking_duration_delta_s"]), rowInvert),
      throttlePickupDeltaM: invertNullable(numberOrNull(throttle?.["throttle_pickup_delta_m"]), rowInvert),
      tractionDelta: invertNullable(numberOrNull(throttle?.["traction_exit_delta"]), rowInvert),
    };
  });

  const energyBySegment = new Map(((energyResult.data ?? []) as Row[]).map((row) => [String(row["segment_id"]), row]));
  const straights: TelemetryStraight[] = ((straightResult.data ?? []) as Row[])
    .filter((row) => pairMatches(row, left, right))
    .slice(0, DETAIL_CAP)
    .map((row, index) => {
      const rowSameOrder = requestedOrder(row, driverA);
      const rowInvert = !rowSameOrder;
      const segmentId = String(row["segment_id"] ?? `straight_${index + 1}`);
      const energy = energyBySegment.get(segmentId);
      return {
        segmentId,
        label: `S${index + 1}`,
        confidence: clampConfidence(row["confidence"]),
        favorableDriver: favorableDriver(row["favorable_driver"], rowSameOrder, driverA, driverB),
        entrySpeedDeltaKph: invertNullable(numberOrNull(row["entry_speed_delta_kph"]), rowInvert),
        terminalSpeedDeltaKph: invertNullable(numberOrNull(row["terminal_speed_delta_kph"]), rowInvert),
        accelerationDelta: invertNullable(numberOrNull(row["acceleration_delta"]), rowInvert),
        drsActiveDeltaPct: invertNullable(numberOrNull(row["drs_active_delta_pct"]), rowInvert),
        clippingProxyDelta: invertNullable(numberOrNull(row["clipping_proxy_delta"]), rowInvert),
        deploymentProxyDelta: invertNullable(numberOrNull(energy?.["deployment_proxy_delta"]), rowInvert),
        liftAndCoastDelta: invertNullable(numberOrNull(energy?.["lift_and_coast_delta"]), rowInvert),
        recoveryZoneDelta: invertNullable(numberOrNull(energy?.["recovery_zone_delta"]), rowInvert),
      };
    });

  const trackRow = ((trackResult.data ?? []) as Row[])[0];
  const track: TelemetryTrackSummary | null = trackRow
    ? {
        archetype: String(trackRow["track_archetype"] ?? selected?.["track_archetype"] ?? "mixed"),
        straightLineWeight: clampConfidence(trackRow["straight_line_weight"]),
        brakingWeight: clampConfidence(trackRow["braking_weight"]),
        tractionWeight: clampConfidence(trackRow["traction_weight"]),
        degradationWeight: clampConfidence(trackRow["degradation_weight"]),
        trackPositionWeight: clampConfidence(trackRow["track_position_weight"]),
        confidence: clampConfidence(trackRow["archetype_confidence"]),
      }
    : null;
  const confidence = clampConfidence(overviewRow?.["confidence"]);
  const traceQuality = Math.min(
    ...traceResult.traces.map((trace) => trace?.quality ?? 0),
  );
  const hasBothTraces = traceResult.traces.every(Boolean);
  const hasAnalytics = Boolean(overview || segments.length || straights.length);
  const availability = hasBothTraces && hasAnalytics ? "available" : hasBothTraces || hasAnalytics ? "partial" : input.resultsOnly ? "results-only" : "unavailable";
  const score = Math.min(confidence ?? 0, traceQuality || 0);
  const qualityLabel = score >= 0.86 ? "Strong telemetry agreement" : score >= 0.68 ? "Moderate telemetry confidence" : score > 0 ? "Limited clean-lap data" : "Partial telemetry coverage";

  return {
    availability,
    availableSessions,
    session: {
      ...baseSession,
      generatedAt: traceResult.payload?.generatedAt ?? baseSession.generatedAt,
      source: traceResult.payload?.source ?? baseSession.source,
    },
    drivers: { a: driverA, b: driverB },
    quality: {
      confidence,
      traceQuality: traceQuality || null,
      label: qualityLabel,
      weakestAssumption: String(overviewRow?.["weakest_assumption"] ?? "Approximate telemetry-derived segment boundaries."),
    },
    overview,
    track,
    traces: traceResult.traces,
    segments,
    straights,
    note: traceResult.payload?.honestyNote ?? "Precomputed representative telemetry trace. Approximate segment context only.",
    proxyNote: ENERGY_PROXY_NOTE,
  };
}
