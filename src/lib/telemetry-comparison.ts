export const TELEMETRY_SESSIONS = ["FP1", "FP2", "FP3", "Q", "SQ", "S", "R"] as const;

export type TelemetrySessionCode = (typeof TELEMETRY_SESSIONS)[number];
export type TelemetryAvailability = "available" | "partial" | "results-only" | "unavailable";

export type TelemetryQuality = {
  confidence: number | null;
  traceQuality: number | null;
  label: string;
  weakestAssumption: string;
};

export type TelemetryPoint = {
  x: number;
  speed: number | null;
  rpm: number | null;
  gear: number | null;
  throttle: number | null;
  brake: number | null;
  drs: number | null;
  energyProxy: number | null;
};

export type TelemetrySpan = { start: number; end: number };

export type TelemetryTrace = {
  driver: string;
  lapNumber: number | null;
  compound: string | null;
  lapKind: string;
  quality: number | null;
  distanceM: number | null;
  rawPointCount: number | null;
  spans: { braking: TelemetrySpan[]; drs: TelemetrySpan[] };
  points: TelemetryPoint[];
};

export type TelemetrySegment = {
  segmentId: string;
  label: string;
  kind: string;
  normalizedStart: number;
  normalizedEnd: number;
  normalizedApex: number;
  confidence: number | null;
  fasterDriver: string | null;
  entryDeltaKph: number | null;
  apexDeltaKph: number | null;
  exitDeltaKph: number | null;
  minDeltaKph: number | null;
  entrySpeedA: number | null;
  entrySpeedB: number | null;
  apexSpeedA: number | null;
  apexSpeedB: number | null;
  exitSpeedA: number | null;
  exitSpeedB: number | null;
  entryGearA: number | null;
  entryGearB: number | null;
  apexGearA: number | null;
  apexGearB: number | null;
  exitGearA: number | null;
  exitGearB: number | null;
  brakingStartDeltaM: number | null;
  brakingDurationDeltaS: number | null;
  throttlePickupDeltaM: number | null;
  tractionDelta: number | null;
};

export type TelemetryStraight = {
  segmentId: string;
  label: string;
  confidence: number | null;
  favorableDriver: string | null;
  entrySpeedDeltaKph: number | null;
  terminalSpeedDeltaKph: number | null;
  accelerationDelta: number | null;
  drsActiveDeltaPct: number | null;
  clippingProxyDelta: number | null;
  deploymentProxyDelta: number | null;
  liftAndCoastDelta: number | null;
  recoveryZoneDelta: number | null;
};

export type TelemetryOverview = {
  segmentWinsA: number;
  segmentWinsB: number;
  straightWinsA: number;
  straightWinsB: number;
  avgSegmentDeltaKph: number | null;
  avgStraightDeltaKph: number | null;
  brakingAdvantage: number | null;
  tractionAdvantage: number | null;
  energyProxyDelta: number | null;
  strategyNote: string;
};

export type TelemetryTrackSummary = {
  archetype: string;
  straightLineWeight: number | null;
  brakingWeight: number | null;
  tractionWeight: number | null;
  degradationWeight: number | null;
  trackPositionWeight: number | null;
  confidence: number | null;
};

export type TelemetryComparison = {
  availability: TelemetryAvailability;
  availableSessions: TelemetrySessionCode[];
  session: {
    id: string | null;
    code: TelemetrySessionCode;
    season: number;
    round: number;
    event: string;
    generatedAt: string | null;
    source: string;
  };
  drivers: { a: string; b: string };
  quality: TelemetryQuality;
  overview: TelemetryOverview | null;
  track: TelemetryTrackSummary | null;
  traces: [TelemetryTrace | null, TelemetryTrace | null];
  segments: TelemetrySegment[];
  straights: TelemetryStraight[];
  note: string;
  proxyNote: string;
};

export const COMPARISON_VIEWS = [
  "gear",
  "straight",
  "corners",
  "pits",
  "entry-exit",
  "dominance",
] as const;

export type ComparisonView = (typeof COMPARISON_VIEWS)[number];

export const COMPARISON_VIEW_META: {
  id: ComparisonView;
  label: string;
  short: string;
  raceOnly?: boolean;
}[] = [
  { id: "gear", label: "Gear Diff", short: "Gear" },
  { id: "straight", label: "Straight-Line Speed", short: "Straights" },
  { id: "corners", label: "Corner Analysis", short: "Corners" },
  { id: "pits", label: "Pit Stops", short: "Pits", raceOnly: true },
  { id: "entry-exit", label: "Entry / Exit Speed", short: "Entry / Exit" },
  { id: "dominance", label: "Dominance", short: "Dominance", raceOnly: true },
];

export type GearDiffPoint = {
  index: number;
  x: number;
  gearA: number | null;
  gearB: number | null;
  diff: number | null;
  shiftA: boolean;
  shiftB: boolean;
};

export type SpeedDominanceZone = {
  index: number;
  start: number;
  end: number;
  midpoint: number;
  deltaKph: number | null;
  leader: "a" | "b" | "neutral";
};

export type ComparisonSelection = {
  view: ComparisonView;
  point: number | null;
  segment: string | null;
  lap: number | null;
  range: [number, number];
};

export const ENERGY_PROXY_NOTE =
  "Energy deployment is a telemetry-derived proxy, not true ERS or battery state.";

export function clampConfidence(value: unknown): number | null {
  const number = value == null || value === "" ? null : Number(value);
  if (number == null || !Number.isFinite(number)) return null;
  return Math.max(0, Math.min(1, number));
}

export function invertNullable(value: number | null, invert: boolean) {
  return value == null ? null : invert ? -value : value;
}

export function approximateSegmentRange(segmentId: string, index: number, count: number) {
  const match = segmentId.match(/(?:corner|segment|turn|straight)[_-]?(\d+)/i);
  const ordinal = match?.[1] ? Math.max(0, Number.parseInt(match[1], 10) - 1) : index;
  const denominator = Math.max(count, ordinal + 1, 1);
  const center = Math.min(0.975, Math.max(0.025, (ordinal + 0.5) / denominator));
  const halfWidth = Math.min(0.045, 0.42 / denominator);
  return {
    start: Math.max(0, center - halfWidth),
    end: Math.min(1, center + halfWidth),
    apex: center,
  };
}

export function buildGearDiffPoints(
  traceA: TelemetryTrace | null,
  traceB: TelemetryTrace | null,
): GearDiffPoint[] {
  const count = Math.min(traceA?.points.length ?? 0, traceB?.points.length ?? 0);
  const rows: GearDiffPoint[] = [];
  for (let index = 0; index < count; index += 1) {
    const a = traceA?.points[index] ?? null;
    const b = traceB?.points[index] ?? null;
    const gearA = a?.gear ?? null;
    const gearB = b?.gear ?? null;
    rows.push({
      index,
      x: ((a?.x ?? b?.x ?? index / Math.max(1, count - 1)) + (b?.x ?? a?.x ?? 0)) / 2,
      gearA,
      gearB,
      diff: gearA == null || gearB == null ? null : gearA - gearB,
      shiftA: index > 0 && gearA != null && rows[index - 1]?.gearA != null && gearA !== rows[index - 1]?.gearA,
      shiftB: index > 0 && gearB != null && rows[index - 1]?.gearB != null && gearB !== rows[index - 1]?.gearB,
    });
  }
  return rows;
}

export function buildSpeedDominanceZones(
  traceA: TelemetryTrace | null,
  traceB: TelemetryTrace | null,
  neutralThresholdKph = 1,
): SpeedDominanceZone[] {
  const count = Math.min(traceA?.points.length ?? 0, traceB?.points.length ?? 0);
  const zones: SpeedDominanceZone[] = [];
  for (let index = 0; index < count; index += 1) {
    const a = traceA?.points[index] ?? null;
    const b = traceB?.points[index] ?? null;
    const midpoint = ((a?.x ?? b?.x ?? index / Math.max(1, count - 1)) + (b?.x ?? a?.x ?? 0)) / 2;
    const previousMidpoint = zones[index - 1]?.midpoint ?? midpoint;
    const nextA = traceA?.points[index + 1]?.x;
    const nextB = traceB?.points[index + 1]?.x;
    const nextMidpoint =
      index === count - 1
        ? midpoint
        : ((nextA ?? nextB ?? midpoint) + (nextB ?? nextA ?? midpoint)) / 2;
    const deltaKph = a?.speed == null || b?.speed == null ? null : a.speed - b.speed;
    zones.push({
      index,
      start: index === 0 ? 0 : (previousMidpoint + midpoint) / 2,
      end: index === count - 1 ? 1 : (midpoint + nextMidpoint) / 2,
      midpoint,
      deltaKph,
      leader:
        deltaKph == null || Math.abs(deltaKph) < neutralThresholdKph
          ? "neutral"
          : deltaKph > 0
            ? "a"
            : "b",
    });
  }
  return zones;
}
