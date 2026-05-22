import { AppHeader } from "@/components/ui/app-header";
import { AnalyticsTrackDominanceMap, type AnalyticsDominanceSegment } from "@/components/analytics/analytics-track-dominance-map";
import { AnalyticsTelemetrySyncScope } from "@/components/analytics/analytics-telemetry-sync-scope";
import { ProductRuntimeNote } from "@/components/ui/product-runtime-note";
import { SiteFooter } from "@/components/ui/site-footer";
import { StatePanel } from "@/components/ui/state-panel";
import { TeamBadge } from "@/components/ui/team-badge";
import { withServerFallback } from "@/lib/errors/logger";
import {
  getAnalyticsComparisonResult,
  getAnalyticsDefaultDriverPair,
  getAnalyticsDrivers,
  listAnalyticsSessionsResult,
  type AnalyticsBrakingHighlight,
  type AnalyticsComparisonPayload,
  type AnalyticsCompareMode,
  type AnalyticsEnergyProxyHighlight,
  type AnalyticsSegmentHighlight,
  type AnalyticsSessionSummary,
  type AnalyticsStraightHighlight,
  type AnalyticsTelemetryTraceComparison,
  type AnalyticsTelemetryTracePoint,
  type AnalyticsThrottleHighlight,
} from "@/lib/server/analytics-product";
import { getCircuitTrackDataForRace } from "@/lib/server/circuit-track-data";
import { formatSeasonRaceLabel, getSeasonState, type SeasonState } from "@/lib/server/season-state";
import type { RuntimeSourceMetadata } from "@/lib/server/runtime-source";
import { getTeamMeta } from "@/lib/ui/team-meta";
import type { CSSProperties } from "react";

type AnalyticsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type MetricCard = {
  label: string;
  value: string;
  note: string;
  tone?: "proxy" | "strong";
};

type AnalyticsTab = Exclude<AnalyticsCompareMode, "all">;

type ChartBar = {
  segmentId: string;
  label: string;
  value: number | null;
  unit: string;
  confidence: number | null;
};

type SegmentOption = {
  segmentId: string;
  label: string;
  kind: string;
  confidence: number | null;
};

type DominantEdge = {
  label: string;
  driver: string;
  value: string;
  note: string;
  tone?: "proxy";
};

type TelemetryInstrument = {
  label: string;
  value: string;
  leader: string;
  fill: number;
  tone?: "brake" | "throttle" | "speed" | "proxy";
};

const analyticsTabs: Array<{ id: AnalyticsTab; label: string; shortLabel: string }> = [
  { id: "overview", label: "Overview", shortLabel: "Overview" },
  { id: "segments", label: "Cornering", shortLabel: "Corner" },
  { id: "braking", label: "Braking", shortLabel: "Brake" },
  { id: "throttle", label: "Throttle", shortLabel: "Throttle" },
  { id: "straights", label: "Straights", shortLabel: "Straight" },
  { id: "energy-proxy", label: "Energy", shortLabel: "Energy" },
];

const sessionPriority: Record<string, number> = {
  R: 7,
  Q: 6,
  SQ: 5,
  S: 4,
  FP3: 3,
  FP2: 2,
  FP1: 1,
};

const unavailableRuntime: RuntimeSourceMetadata = {
  surface: "analytics",
  mode: "unavailable",
  sourceKind: null,
  sourceLabel: null,
  reason: "Analytics data failed to load.",
  generatedAt: null,
  buildVersion: null,
  eventId: null,
  season: null,
  round: null,
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeTeamId(team: string | null | undefined) {
  return (team ?? "constructor").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function normalizeTab(value: string | string[] | undefined): AnalyticsTab {
  const candidate = firstParam(value);
  return analyticsTabs.some((tab) => tab.id === candidate) ? candidate as AnalyticsTab : "overview";
}

function confidenceTier(confidence: number | null | undefined, telemetryQuality?: number | null) {
  const score = Math.min(confidence ?? 0, telemetryQuality ?? confidence ?? 0);
  if (score >= 0.86) return "Strong telemetry agreement";
  if (score >= 0.68) return "Moderate telemetry confidence";
  if (score >= 0.45) return "Traffic-adjusted inference";
  if (score > 0) return "Limited clean-lap data";
  return "Incomplete session confidence";
}

function compactSignalLabel(confidence: number | null | undefined) {
  const tier = confidenceTier(confidence);
  if (tier === "Traffic-adjusted inference") return "Telemetry-derived";
  if (tier === "Strong telemetry agreement") return "Strong signal";
  if (tier === "Moderate telemetry confidence") return "Moderate signal";
  if (tier === "Limited clean-lap data") return "Limited signal";
  return "Incomplete signal";
}

function telemetryQualityTier(value: number | null | undefined) {
  if (value === null || value === undefined) return "Telemetry unavailable";
  if (value >= 0.95) return "Clean telemetry set";
  if (value >= 0.8) return "Mostly clean telemetry";
  if (value >= 0.55) return "Partial telemetry set";
  return "Incomplete telemetry";
}

function formatSigned(value: number | null | undefined, unit = "") {
  if (value === null || value === undefined || !Number.isFinite(value)) return "Even";
  if (Math.abs(value) < 0.0001) return "Even";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}${unit}`;
}

function formatCompactSigned(value: number | null | undefined, unit = "") {
  if (value === null || value === undefined || !Number.isFinite(value)) return "n/a";
  if (Math.abs(value) < 0.0001) return `0${unit}`;
  return `${value > 0 ? "+" : ""}${value.toFixed(Math.abs(value) >= 10 ? 1 : 2)}${unit}`;
}

function formatChartValue(value: number | null | undefined, unit = "") {
  if (value === null || value === undefined || !Number.isFinite(value)) return "n/a";
  if (Math.abs(value) < 0.0001) return `0${unit}`;
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}${unit}`;
}

function edgeLabel(value: number | null | undefined, driverA: string, driverB: string) {
  if (value === null || value === undefined || Math.abs(value) < 0.0001) {
    return "Even";
  }

  return value > 0 ? driverA : driverB;
}

function buildDominantEdge(comparison: AnalyticsComparisonPayload): DominantEdge {
  const { overview } = comparison;
  const driverA = overview.driverA;
  const driverB = overview.driverB;
  const segmentMargin = overview.segmentAdvantageCountA - overview.segmentAdvantageCountB;
  const straightDelta = overview.avgStraightDeltaKph ?? 0;
  const brakingDelta = overview.brakingAdvantageScore ?? 0;
  const tractionDelta = overview.tractionAdvantageScore ?? 0;
  const energyDelta = overview.energyDeploymentProxyDelta ?? 0;
  const candidates: Array<DominantEdge & { score: number }> = [
    {
      label: "Segment command",
      driver: segmentMargin === 0 ? "Even" : segmentMargin > 0 ? driverA : driverB,
      value: `${Math.abs(segmentMargin)} seg`,
      note: "Approximate segment count edge",
      score: Math.abs(segmentMargin) / Math.max(1, overview.segmentAdvantageCountA + overview.segmentAdvantageCountB),
    },
    {
      label: "Straight-line edge",
      driver: edgeLabel(straightDelta, driverA, driverB),
      value: formatCompactSigned(straightDelta, " kph"),
      note: "Terminal-speed and acceleration signal",
      score: Math.min(1, Math.abs(straightDelta) / 8),
    },
    {
      label: "Braking edge",
      driver: edgeLabel(brakingDelta, driverA, driverB),
      value: formatCompactSigned(brakingDelta),
      note: "Late-brake and intensity signal",
      score: Math.min(1, Math.abs(brakingDelta) / 0.12),
    },
    {
      label: "Traction exit",
      driver: edgeLabel(tractionDelta, driverA, driverB),
      value: formatCompactSigned(tractionDelta),
      note: "Throttle pickup and exit traction",
      score: Math.min(1, Math.abs(tractionDelta) / 0.12),
    },
    {
      label: "Energy deployment proxy",
      driver: edgeLabel(energyDelta, driverA, driverB),
      value: formatCompactSigned(energyDelta),
      note: "Proxy only; speed-shape evidence",
      tone: "proxy",
      score: Math.min(1, Math.abs(energyDelta) / 0.12),
    },
  ];

  return [...candidates].sort((a, b) => b.score - a.score)[0] ?? {
    label: "Telemetry edge",
    driver: "Even",
    value: "Even",
    note: "No single area dominates",
  };
}

function countEdgeLabel(countA: number, countB: number, driverA: string, driverB: string) {
  if (countA === countB) return "Even";
  return countA > countB ? driverA : driverB;
}

function buildMetricCards(comparison: AnalyticsComparisonPayload): MetricCard[] {
  const { overview } = comparison;
  const driverA = overview.driverA;
  const driverB = overview.driverB;

  return [
    {
      label: "Approx segments",
      value: countEdgeLabel(overview.segmentAdvantageCountA, overview.segmentAdvantageCountB, driverA, driverB),
      note: `${driverA} ${overview.segmentAdvantageCountA} / ${driverB} ${overview.segmentAdvantageCountB}`,
      tone: "strong",
    },
    {
      label: "Straight-line",
      value: countEdgeLabel(overview.straightAdvantageCountA, overview.straightAdvantageCountB, driverA, driverB),
      note: `${formatSigned(overview.avgStraightDeltaKph, " kph")} average delta`,
    },
    {
      label: "Braking",
      value: edgeLabel(overview.brakingAdvantageScore, driverA, driverB),
      note: `${formatSigned(overview.brakingAdvantageScore)} score delta`,
    },
    {
      label: "Traction exit",
      value: edgeLabel(overview.tractionAdvantageScore, driverA, driverB),
      note: `${formatSigned(overview.tractionAdvantageScore)} score delta`,
    },
    {
      label: "Energy proxy",
      value: edgeLabel(overview.energyDeploymentProxyDelta, driverA, driverB),
      note: `${formatSigned(overview.energyDeploymentProxyDelta)} proxy delta`,
      tone: "proxy",
    },
    {
      label: "Data strength",
      value: confidenceTier(overview.confidence, comparison.session.telemetryQualityMean),
      note: "Telemetry quality plus agreement",
    },
  ];
}

function instrumentFill(value: number | null | undefined, scale: number) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 8;
  return Math.max(8, Math.min(100, Math.abs(value) / scale * 100));
}

function buildTelemetryInstruments(comparison: AnalyticsComparisonPayload): TelemetryInstrument[] {
  const { overview } = comparison;
  const driverA = overview.driverA;
  const driverB = overview.driverB;

  return [
    {
      label: "Speed",
      value: formatCompactSigned(overview.avgStraightDeltaKph, " kph"),
      leader: edgeLabel(overview.avgStraightDeltaKph, driverA, driverB),
      fill: instrumentFill(overview.avgStraightDeltaKph, 8),
      tone: "speed",
    },
    {
      label: "Brake",
      value: formatCompactSigned(overview.brakingAdvantageScore),
      leader: edgeLabel(overview.brakingAdvantageScore, driverA, driverB),
      fill: instrumentFill(overview.brakingAdvantageScore, 0.12),
      tone: "brake",
    },
    {
      label: "Traction",
      value: formatCompactSigned(overview.tractionAdvantageScore),
      leader: edgeLabel(overview.tractionAdvantageScore, driverA, driverB),
      fill: instrumentFill(overview.tractionAdvantageScore, 0.12),
      tone: "throttle",
    },
    {
      label: "Energy proxy",
      value: formatCompactSigned(overview.energyDeploymentProxyDelta),
      leader: edgeLabel(overview.energyDeploymentProxyDelta, driverA, driverB),
      fill: instrumentFill(overview.energyDeploymentProxyDelta, 0.12),
      tone: "proxy",
    },
  ];
}

function sessionLabel(session: AnalyticsSessionSummary) {
  const sessionName = session.session === "R" ? "Race" : session.session === "Q" ? "Qualifying" : session.session;
  return `${sessionName} - ${telemetryQualityTier(session.telemetryQualityMean)}`;
}

function sessionGroupLabel(session: AnalyticsSessionSummary, seasonState: SeasonState | null) {
  const latestTelemetry = seasonState?.latest_completed_race_with_analytics;
  const suffix = latestTelemetry?.season === session.season && latestTelemetry.round === session.round ? " - latest telemetry" : "";
  return `${session.season} R${session.round} ${session.event}${suffix}`;
}

function groupSessions(sessions: AnalyticsSessionSummary[], seasonState: SeasonState | null) {
  const groups = new Map<string, { label: string; sessions: AnalyticsSessionSummary[] }>();
  for (const session of sessions) {
    const key = `${session.season}-${session.round}-${session.event}`;
    const group = groups.get(key) ?? { label: sessionGroupLabel(session, seasonState), sessions: [] };
    group.sessions.push(session);
    groups.set(key, group);
  }

  return [...groups.values()].map((group) => ({
    ...group,
    sessions: group.sessions.sort((left, right) => (sessionPriority[right.session] ?? 0) - (sessionPriority[left.session] ?? 0)),
  }));
}

function pickSessionByRace(sessions: AnalyticsSessionSummary[], race: SeasonState["latest_completed_race_with_analytics"] | null | undefined) {
  if (!race?.season || !race.round) {
    return null;
  }

  const raceSessions = sessions.filter((session) => session.season === race.season && session.round === race.round);
  return raceSessions.sort((left, right) => (sessionPriority[right.session] ?? 0) - (sessionPriority[left.session] ?? 0))[0] ?? null;
}

function selectDefaultSession(sessions: AnalyticsSessionSummary[], sessionIdParam: string | undefined, seasonState: SeasonState | null) {
  return (
    sessions.find((session) => session.id === sessionIdParam)
    ?? pickSessionByRace(sessions, seasonState?.latest_completed_race_with_analytics)
    ?? sessions[0]
    ?? null
  );
}

function segmentShortLabel(segmentId: string, fallbackKind = "approximate segment") {
  const suffix = segmentId.match(/(?:segment|straight|corner|zone)_?(\d+)$/i)?.[1] ?? segmentId.split("_").at(-1) ?? segmentId;
  const kind = fallbackKind.toLowerCase().includes("straight") ? "Straight segment" : fallbackKind.toLowerCase().includes("braking") ? "Braking zone" : "Approx segment";
  return `${kind} ${suffix}`;
}

function honestSegmentKind(kind: string) {
  const normalized = kind.replaceAll("_", " ").toLowerCase();
  if (normalized.includes("straight")) return "straight";
  if (normalized.includes("braking")) return "braking zone";
  if (normalized.includes("traction")) return "traction segment";
  return "approximate segment";
}

function buildHref(params: {
  sessionId: string;
  driverA: string | null;
  driverB: string | null;
  tab: AnalyticsTab;
  segmentId?: string | null;
}) {
  const search = new URLSearchParams({
    sessionId: params.sessionId,
    tab: params.tab,
  });
  if (params.driverA) search.set("driverA", params.driverA);
  if (params.driverB) search.set("driverB", params.driverB);
  if (params.segmentId) search.set("segmentId", params.segmentId);
  return `/analytics?${search.toString()}`;
}

function ChartRows({ rows, driverA, driverB, selectedSegmentId }: { rows: ChartBar[]; driverA: string; driverB: string; selectedSegmentId: string | null }) {
  if (rows.length === 0) {
    return (
      <div className="analytics-page__empty-chart">
        <span>No detail rows</span>
        <p>This mode has no prepared rows for the selected pair.</p>
      </div>
    );
  }

  const maxMagnitude = Math.max(1, ...rows.map((row) => Math.abs(row.value ?? 0)));

  return (
    <div className="analytics-chart" aria-label={`${driverA} versus ${driverB} delta chart`}>
      {rows.map((row) => {
        const value = row.value ?? 0;
        const magnitude = Math.min(100, Math.abs(value) / maxMagnitude * 100);
        const leader = value > 0 ? driverA : value < 0 ? driverB : "Even";
        return (
          <div
            className={`analytics-chart__row${row.segmentId === selectedSegmentId ? " analytics-chart__row--selected" : ""}`}
            key={row.label}
            data-sync-id={row.segmentId}
            tabIndex={0}
          >
            <div className="analytics-chart__meta">
              <strong>{row.label}</strong>
              <span>{row.segmentId === selectedSegmentId ? "Selected - " : ""}{compactSignalLabel(row.confidence)}</span>
            </div>
            <div className="analytics-chart__track">
              <div className="analytics-chart__midline" />
              <div
                className={`analytics-chart__bar${value < 0 ? " analytics-chart__bar--negative" : ""}`}
                style={{ width: `${magnitude / 2}%` }}
              />
            </div>
            <div className="analytics-chart__value">
              <strong>{formatChartValue(row.value, row.unit)}</strong>
              <span>{leader}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function modeCopy(activeTab: AnalyticsTab) {
  if (activeTab === "braking") {
    return {
      eyebrow: "Braking telemetry",
      title: "Brake zone analysis.",
      focus: "Late-brake signal",
      note: "Summary traces from braking product views.",
    };
  }
  if (activeTab === "throttle") {
    return {
      eyebrow: "Throttle telemetry",
      title: "Exit traction analysis.",
      focus: "Pickup and modulation",
      note: "Throttle pickup and traction-exit summaries.",
    };
  }
  if (activeTab === "straights") {
    return {
      eyebrow: "Straight-line telemetry",
      title: "Acceleration corridor.",
      focus: "Terminal speed",
      note: "Straight-speed, DRS, and acceleration summaries.",
    };
  }
  if (activeTab === "energy-proxy") {
    return {
      eyebrow: "Energy deployment proxy",
      title: "Proxy deployment phases.",
      focus: "Speed-shape proxy",
      note: "Proxy only; not direct energy data.",
    };
  }
  if (activeTab === "segments") {
    return {
      eyebrow: "Cornering telemetry",
      title: "Approximate segment rhythm.",
      focus: "Entry, apex, exit",
      note: "Approximate segment speed summaries.",
    };
  }
  return {
    eyebrow: "Overview",
    title: "Track dominance read.",
    focus: "Driver advantage",
    note: "Real circuit geometry with approximate markers.",
  };
}

function tracePath(index: number, value: number, maxMagnitude: number, polarity: "a" | "b") {
  const base = 44 + index * 28;
  const sign = polarity === "a" ? -1 : 1;
  const amp = Math.min(24, Math.max(5, Math.abs(value) / maxMagnitude * 24));
  const phase = index % 2 === 0 ? 1 : -1;
  return [
    `M 16 ${base}`,
    `C 58 ${base + sign * amp * 0.3} 88 ${base + phase * amp} 128 ${base + sign * amp}`,
    `S 218 ${base - phase * amp * 0.55} 278 ${base + sign * amp * 0.45}`,
    `S 344 ${base + phase * amp * 0.35} 384 ${base}`,
  ].join(" ");
}

function traceValue(point: AnalyticsTelemetryTracePoint, channel: "speed" | "rpm" | "gear" | "throttle" | "brake" | "drs" | "energyProxy") {
  return point[channel];
}

function channelDomain(
  traces: AnalyticsTelemetryTraceComparison,
  channel: "speed" | "rpm" | "gear" | "throttle" | "brake" | "drs" | "energyProxy",
) {
  if (channel === "rpm") return { min: 0, max: 13000 };
  if (channel === "gear") return { min: 0, max: 8 };
  if (channel === "throttle" || channel === "brake") return { min: 0, max: 100 };
  if (channel === "drs" || channel === "energyProxy") return { min: 0, max: 1 };
  const values = [traces.driverA, traces.driverB]
    .flatMap((trace) => trace?.points.map((point) => traceValue(point, channel)).filter((value): value is number => typeof value === "number") ?? []);
  const min = Math.min(...values, 80);
  const max = Math.max(...values, 330);
  return max - min < 10 ? { min: Math.max(0, min - 20), max: max + 20 } : { min, max };
}

function channelPath(
  points: AnalyticsTelemetryTracePoint[],
  channel: "speed" | "rpm" | "gear" | "throttle" | "brake" | "drs" | "energyProxy",
  y: number,
  height: number,
  domain: { min: number; max: number },
) {
  const width = 468;
  const xOffset = 34;
  const range = Math.max(0.001, domain.max - domain.min);
  return points.map((point, index) => {
    const value = traceValue(point, channel) ?? domain.min;
    const x = xOffset + point.x * width;
    const yPoint = y + height - ((value - domain.min) / range) * height;
    return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${Math.max(y, Math.min(y + height, yPoint)).toFixed(2)}`;
  }).join(" ");
}

function traceChannels(activeTab: AnalyticsTab): Array<{
  key: "speed" | "rpm" | "gear" | "throttle" | "brake" | "drs" | "energyProxy";
  label: string;
  unit: string;
}> {
  if (activeTab === "braking") {
    return [
      { key: "speed", label: "Speed", unit: "kph" },
      { key: "brake", label: "Brake", unit: "%" },
      { key: "throttle", label: "Throttle", unit: "%" },
      { key: "gear", label: "Gear", unit: "" },
    ];
  }
  if (activeTab === "throttle" || activeTab === "segments") {
    return [
      { key: "speed", label: "Speed", unit: "kph" },
      { key: "throttle", label: "Throttle", unit: "%" },
      { key: "brake", label: "Brake", unit: "%" },
      { key: "gear", label: "Gear", unit: "" },
    ];
  }
  if (activeTab === "straights") {
    return [
      { key: "speed", label: "Speed", unit: "kph" },
      { key: "drs", label: "DRS", unit: "" },
      { key: "throttle", label: "Throttle", unit: "%" },
      { key: "gear", label: "Gear", unit: "" },
    ];
  }
  if (activeTab === "energy-proxy") {
    return [
      { key: "speed", label: "Speed", unit: "kph" },
      { key: "energyProxy", label: "Energy proxy", unit: "" },
      { key: "throttle", label: "Throttle", unit: "%" },
      { key: "drs", label: "DRS", unit: "" },
    ];
  }
  return [
    { key: "speed", label: "Speed", unit: "kph" },
    { key: "throttle", label: "Throttle", unit: "%" },
    { key: "brake", label: "Brake", unit: "%" },
  ];
}

function RealTelemetryTraceStack({
  traces,
  activeTab,
  driverA,
  driverB,
  focusRegions,
  selectedSegmentId,
}: {
  traces: AnalyticsTelemetryTraceComparison;
  activeTab: AnalyticsTab;
  driverA: string;
  driverB: string;
  focusRegions: SegmentOption[];
  selectedSegmentId: string | null;
}) {
  if (!traces.available || !traces.driverA || !traces.driverB) {
    return null;
  }

  const mode = modeCopy(activeTab);
  const channels = traceChannels(activeTab);
  const laneHeight = 54;
  const laneGap = 12;
  const top = 58;
  const svgHeight = top + channels.length * laneHeight + (channels.length - 1) * laneGap + 34;
  const brakeSpans = traces.driverA.spans.braking.length > 0 ? traces.driverA.spans.braking : traces.driverB.spans.braking;
  const drsSpans = traces.driverA.spans.drs.length > 0 ? traces.driverA.spans.drs : traces.driverB.spans.drs;
  const visibleRegions = focusRegions.slice(0, 10);

  return (
    <div className={`analytics-real-trace analytics-real-trace--${activeTab}`} aria-label={`${mode.title} representative telemetry traces`}>
      <div className="analytics-real-trace__header">
        <span>Representative telemetry</span>
        <strong>{mode.focus}</strong>
        <em>{traces.qualityTier}</em>
      </div>
      <svg viewBox={`0 0 540 ${svgHeight}`} className="analytics-real-trace__svg" role="img" aria-label={`${driverA} and ${driverB} representative telemetry overlay`}>
        <rect x="0" y="0" width="540" height={svgHeight} className="analytics-real-trace__backdrop" />
        {[0, 0.25, 0.5, 0.75, 1].map((x) => (
          <line key={x} x1={34 + x * 468} x2={34 + x * 468} y1="44" y2={svgHeight - 22} className="analytics-real-trace__grid" />
        ))}
        {visibleRegions.map((region, index) => {
          const start = index / Math.max(1, visibleRegions.length);
          const end = (index + 1) / Math.max(1, visibleRegions.length);
          return (
            <rect
              key={region.segmentId}
              x={34 + start * 468}
              y="44"
              width={Math.max(4, (end - start) * 468)}
              height={svgHeight - 66}
              className={`analytics-real-trace__focus-region${region.segmentId === selectedSegmentId ? " analytics-real-trace__focus-region--selected" : ""}`}
              data-sync-id={region.segmentId}
              tabIndex={0}
              aria-label={`${region.label}, approximate telemetry region`}
            />
          );
        })}
        {brakeSpans.map((span, index) => (
          <rect
            key={`brake-${index}`}
            x={34 + span.start * 468}
            y="44"
            width={Math.max(2, (span.end - span.start) * 468)}
            height={svgHeight - 66}
            className="analytics-real-trace__brake-zone"
          />
        ))}
        {activeTab === "straights" || activeTab === "energy-proxy" ? drsSpans.map((span, index) => (
          <rect
            key={`drs-${index}`}
            x={34 + span.start * 468}
            y="44"
            width={Math.max(2, (span.end - span.start) * 468)}
            height={svgHeight - 66}
            className="analytics-real-trace__drs-zone"
          />
        )) : null}
        {channels.map((channel, index) => {
          const y = top + index * (laneHeight + laneGap);
          const domain = channelDomain(traces, channel.key);
          return (
            <g key={channel.key}>
              <line x1="34" x2="502" y1={y + laneHeight} y2={y + laneHeight} className="analytics-real-trace__axis" />
              <text x="16" y={y + 20} className="analytics-real-trace__label">{channel.label}</text>
              <text x="524" y={y + 20} className="analytics-real-trace__unit">{channel.unit}</text>
              <path d={channelPath(traces.driverA!.points, channel.key, y, laneHeight, domain)} className="analytics-real-trace__line-a" />
              <path d={channelPath(traces.driverB!.points, channel.key, y, laneHeight, domain)} className="analytics-real-trace__line-b" />
            </g>
          );
        })}
      </svg>
      <div className="analytics-real-trace__footer">
        <span><i className="analytics-page__legend-a" />{driverA} lap {traces.driverA.lapNumber ?? "n/a"}</span>
        <span><i className="analytics-page__legend-b" />{driverB} lap {traces.driverB.lapNumber ?? "n/a"}</span>
        <span>{traces.note}</span>
      </div>
      {visibleRegions.length > 0 ? (
        <div className="analytics-sync-rhythm" aria-label="Approximate telemetry rhythm rail">
          {visibleRegions.map((region, index) => (
            <a
              key={region.segmentId}
              href={`#${region.segmentId}`}
              className={`analytics-sync-rhythm__cell${region.segmentId === selectedSegmentId ? " analytics-sync-rhythm__cell--selected" : ""}`}
              data-sync-id={region.segmentId}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{region.kind}</strong>
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TelemetryTraceStack({
  rows,
  activeTab,
  driverA,
  driverB,
  selectedSegmentId,
  telemetryTraces,
  focusRegions,
}: {
  rows: ChartBar[];
  activeTab: AnalyticsTab;
  driverA: string;
  driverB: string;
  selectedSegmentId: string | null;
  telemetryTraces: AnalyticsTelemetryTraceComparison;
  focusRegions: SegmentOption[];
}) {
  const realTrace = (
    <RealTelemetryTraceStack
      traces={telemetryTraces}
      activeTab={activeTab}
      driverA={driverA}
      driverB={driverB}
      focusRegions={focusRegions}
      selectedSegmentId={selectedSegmentId}
    />
  );
  if (realTrace.props.traces.available) {
    return realTrace;
  }

  if (rows.length === 0) {
    return (
      <div className="analytics-mode-graph analytics-mode-graph--empty">
        <span>No telemetry product rows</span>
        <strong>{modeCopy(activeTab).title}</strong>
        <p>Prepared rows are unavailable for this pair.</p>
      </div>
    );
  }

  const visibleRows = rows.slice(0, activeTab === "braking" ? 8 : 7);
  const maxMagnitude = Math.max(1, ...visibleRows.map((row) => Math.abs(row.value ?? 0)));
  const mode = modeCopy(activeTab);

  return (
    <div className={`analytics-mode-graph analytics-mode-graph--${activeTab}`} aria-label={`${mode.title} ${driverA} versus ${driverB}`}>
      <div className="analytics-mode-graph__header">
        <span>{mode.eyebrow}</span>
        <strong>{mode.focus}</strong>
        <em>{mode.note}</em>
      </div>
      <svg viewBox="0 0 400 290" className="analytics-mode-graph__svg" role="img" aria-label={`${mode.focus} summary traces`}>
        <defs>
          <linearGradient id={`trace-a-${activeTab}`} x1="0" x2="1">
            <stop offset="0%" stopColor="var(--team-a)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--team-a-secondary)" />
          </linearGradient>
          <linearGradient id={`trace-b-${activeTab}`} x1="0" x2="1">
            <stop offset="0%" stopColor="var(--team-b)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--team-b-secondary)" />
          </linearGradient>
        </defs>
        {Array.from({ length: 8 }).map((_, index) => (
          <line key={`grid-${index}`} x1={16 + index * 52} x2={16 + index * 52} y1="28" y2="260" className="analytics-mode-graph__grid-line" />
        ))}
        {visibleRows.map((row, index) => {
          const value = row.value ?? 0;
          const leader = value > 0 ? driverA : value < 0 ? driverB : "EVEN";
          const selected = row.segmentId === selectedSegmentId;
          return (
            <g key={row.segmentId} className={selected ? "analytics-mode-graph__trace analytics-mode-graph__trace--selected" : "analytics-mode-graph__trace"}>
              <path d={tracePath(index, value || 0.2, maxMagnitude, "b")} className="analytics-mode-graph__trace-b" />
              <path d={tracePath(index, -value || -0.2, maxMagnitude, "a")} className="analytics-mode-graph__trace-a" />
              <circle cx={36 + index * 38} cy={44 + index * 28} r={selected ? 5 : 3} className={value >= 0 ? "analytics-mode-graph__node-a" : "analytics-mode-graph__node-b"} />
              <text x="388" y={48 + index * 28} textAnchor="end">{leader}</text>
            </g>
          );
        })}
      </svg>
      <div className="analytics-mode-graph__legend">
        <span><i className="analytics-page__legend-a" />{driverA}</span>
        <span><i className="analytics-page__legend-b" />{driverB}</span>
        <span>Approximate segment summaries</span>
      </div>
    </div>
  );
}

function segmentBars(rows: AnalyticsSegmentHighlight[]): ChartBar[] {
  return rows.map((row) => ({
    segmentId: row.segmentId,
    label: segmentShortLabel(row.segmentId, row.segmentKind),
    value: row.exitSpeedDeltaKph ?? row.apexSpeedDeltaKph ?? row.entrySpeedDeltaKph,
    unit: " kph",
    confidence: row.confidence ?? row.segmentConfidence,
  }));
}

function brakingBars(rows: AnalyticsBrakingHighlight[]): ChartBar[] {
  return rows.map((row) => ({
    segmentId: row.segmentId,
    label: segmentShortLabel(row.segmentId, "braking zone"),
    value: row.lateBrakeDelta ?? row.brakeIntensityDelta,
    unit: "",
    confidence: row.confidence,
  }));
}

function throttleBars(rows: AnalyticsThrottleHighlight[]): ChartBar[] {
  return rows.map((row) => ({
    segmentId: row.segmentId,
    label: segmentShortLabel(row.segmentId, "traction segment"),
    value: row.tractionExitDelta ?? row.throttlePickupDeltaM,
    unit: "",
    confidence: row.confidence,
  }));
}

function straightBars(rows: AnalyticsStraightHighlight[]): ChartBar[] {
  return rows.map((row) => ({
    segmentId: row.segmentId,
    label: segmentShortLabel(row.segmentId, "straight"),
    value: row.terminalSpeedDeltaKph,
    unit: " kph",
    confidence: row.confidence,
  }));
}

function energyBars(rows: AnalyticsEnergyProxyHighlight[]): ChartBar[] {
  return rows.map((row) => ({
    segmentId: row.segmentId,
    label: segmentShortLabel(row.segmentId, "approximate segment"),
    value: row.deploymentProxyDelta ?? row.clippingProxyDelta,
    unit: "",
    confidence: row.confidence,
  }));
}

function buildSegmentOptions(comparison: AnalyticsComparisonPayload, activeTab: AnalyticsTab): SegmentOption[] {
  if (activeTab === "segments") {
    return comparison.segmentHighlights.map((row) => ({
      segmentId: row.segmentId,
      label: segmentShortLabel(row.segmentId, row.segmentKind),
      kind: honestSegmentKind(row.segmentKind),
      confidence: row.confidence ?? row.segmentConfidence,
    }));
  }
  if (activeTab === "braking") {
    return comparison.brakingHighlights.map((row) => ({
      segmentId: row.segmentId,
      label: segmentShortLabel(row.segmentId, "braking zone"),
      kind: "braking zone",
      confidence: row.confidence,
    }));
  }
  if (activeTab === "throttle") {
    return comparison.throttleHighlights.map((row) => ({
      segmentId: row.segmentId,
      label: segmentShortLabel(row.segmentId, "traction segment"),
      kind: "traction segment",
      confidence: row.confidence,
    }));
  }
  if (activeTab === "straights") {
    return comparison.straightHighlights.map((row) => ({
      segmentId: row.segmentId,
      label: segmentShortLabel(row.segmentId, "straight"),
      kind: "straight",
      confidence: row.confidence,
    }));
  }
  if (activeTab === "energy-proxy") {
    return comparison.energyProxyHighlights.map((row) => ({
      segmentId: row.segmentId,
      label: segmentShortLabel(row.segmentId, "approximate segment"),
      kind: "energy deployment proxy segment",
      confidence: row.confidence,
    }));
  }
  return [];
}

function selectedSegmentMetrics(comparison: AnalyticsComparisonPayload, activeTab: AnalyticsTab, segmentId: string | null): MetricCard[] {
  if (!segmentId) return [];
  if (activeTab === "segments") {
    const row = comparison.segmentHighlights.find((item) => item.segmentId === segmentId);
    return row ? [
      { label: "Entry delta", value: formatCompactSigned(row.entrySpeedDeltaKph, " kph"), note: "Speed delta at approximate segment entry" },
      { label: "Apex/min delta", value: formatCompactSigned(row.apexSpeedDeltaKph ?? row.minSpeedDeltaKph, " kph"), note: "Mid-segment speed evidence" },
      { label: "Exit delta", value: formatCompactSigned(row.exitSpeedDeltaKph, " kph"), note: `${row.fasterDriver ?? "Even"} faster by selected metric` },
    ] : [];
  }
  if (activeTab === "braking") {
    const row = comparison.brakingHighlights.find((item) => item.segmentId === segmentId);
    return row ? [
      { label: "Brake start", value: formatCompactSigned(row.brakingStartDeltaM, " m"), note: "Relative braking start distance" },
      { label: "Duration", value: formatCompactSigned(row.brakingDurationDeltaS, " s"), note: "Braking duration delta" },
      { label: "Intensity", value: formatCompactSigned(row.brakeIntensityDelta), note: `${row.favorableDriver ?? "Even"} favorable on this proxy` },
    ] : [];
  }
  if (activeTab === "throttle") {
    const row = comparison.throttleHighlights.find((item) => item.segmentId === segmentId);
    return row ? [
      { label: "Pickup", value: formatCompactSigned(row.throttlePickupDeltaM, " m"), note: "Throttle pickup distance delta" },
      { label: "Full throttle", value: formatCompactSigned(row.fullThrottleExitDeltaM, " m"), note: "Full-throttle exit distance delta" },
      { label: "Traction exit", value: formatCompactSigned(row.tractionExitDelta), note: `${row.favorableDriver ?? "Even"} favorable on this proxy` },
    ] : [];
  }
  if (activeTab === "straights") {
    const row = comparison.straightHighlights.find((item) => item.segmentId === segmentId);
    return row ? [
      { label: "Entry speed", value: formatCompactSigned(row.entrySpeedDeltaKph, " kph"), note: "Straight entry speed delta" },
      { label: "Terminal speed", value: formatCompactSigned(row.terminalSpeedDeltaKph, " kph"), note: "End-of-straight speed delta" },
      { label: "DRS delta", value: formatCompactSigned(row.drsActiveDeltaPct, "%"), note: `${row.favorableDriver ?? "Even"} favorable overall` },
    ] : [];
  }
  if (activeTab === "energy-proxy") {
    const row = comparison.energyProxyHighlights.find((item) => item.segmentId === segmentId);
    return row ? [
      { label: "Deployment proxy", value: formatCompactSigned(row.deploymentProxyDelta), note: "Speed-shape deployment proxy delta", tone: "proxy" },
      { label: "Lift/coast", value: formatCompactSigned(row.liftAndCoastDelta), note: "Lift-and-coast proxy delta", tone: "proxy" },
      { label: "Clipping proxy", value: formatCompactSigned(row.clippingProxyDelta), note: "High-speed plateau proxy delta", tone: "proxy" },
    ] : [];
  }
  return [];
}

function activeChartRows(comparison: AnalyticsComparisonPayload, activeTab: AnalyticsTab) {
  if (activeTab === "segments") return segmentBars(comparison.segmentHighlights);
  if (activeTab === "braking") return brakingBars(comparison.brakingHighlights);
  if (activeTab === "throttle") return throttleBars(comparison.throttleHighlights);
  if (activeTab === "straights") return straightBars(comparison.straightHighlights);
  if (activeTab === "energy-proxy") return energyBars(comparison.energyProxyHighlights);
  return [];
}

function buildTeamStyle(comparison: AnalyticsComparisonPayload | null): CSSProperties {
  const teamA = getTeamMeta(normalizeTeamId(comparison?.overview.driverATeam));
  const teamB = getTeamMeta(normalizeTeamId(comparison?.overview.driverBTeam));
  return {
    "--team-a": teamA.primary,
    "--team-a-secondary": teamA.secondary,
    "--team-b": teamB.primary,
    "--team-b-secondary": teamB.secondary,
  } as CSSProperties;
}

function buildDominanceSegments(comparison: AnalyticsComparisonPayload): AnalyticsDominanceSegment[] {
  const driverA = comparison.overview.driverA;
  const driverB = comparison.overview.driverB;
  const segmentRows = comparison.segmentHighlights.map((row) => {
    const value = row.exitSpeedDeltaKph ?? row.apexSpeedDeltaKph ?? row.entrySpeedDeltaKph ?? 0;
    return {
      segmentId: row.segmentId,
      label: segmentShortLabel(row.segmentId, row.segmentKind),
      kind: honestSegmentKind(row.segmentKind),
      leader: value > 0 ? driverA : value < 0 ? driverB : "Even",
      value,
      confidence: row.confidence ?? row.segmentConfidence,
    };
  });

  if (segmentRows.length > 0) {
    return segmentRows.slice(0, 14);
  }

  return comparison.straightHighlights.slice(0, 10).map((row) => {
    const value = row.terminalSpeedDeltaKph ?? 0;
    return {
      segmentId: row.segmentId,
      label: segmentShortLabel(row.segmentId, "straight"),
      kind: "straight",
      leader: value > 0 ? driverA : value < 0 ? driverB : "Even",
      value,
      confidence: row.confidence,
    };
  });
}

function buildEngineerInsights(comparison: AnalyticsComparisonPayload, dominantEdge: DominantEdge | null): MetricCard[] {
  const { overview } = comparison;
  return [
    {
      label: "Strongest area",
      value: dominantEdge?.label ?? "Even",
      note: dominantEdge ? `${dominantEdge.driver} ${dominantEdge.value}` : "No single telemetry edge dominates",
      tone: "strong",
    },
    {
      label: "Overtaking edge",
      value: edgeLabel(overview.avgStraightDeltaKph, overview.driverA, overview.driverB),
      note: `${formatCompactSigned(overview.avgStraightDeltaKph, " kph")} straight-line delta`,
    },
    {
      label: "Traction edge",
      value: edgeLabel(overview.tractionAdvantageScore, overview.driverA, overview.driverB),
      note: `${formatCompactSigned(overview.tractionAdvantageScore)} exit score`,
    },
    {
      label: "Braking read",
      value: confidenceTier(overview.confidence, comparison.session.telemetryQualityMean),
      note: `${edgeLabel(overview.brakingAdvantageScore, overview.driverA, overview.driverB)} leads braking signal`,
    },
    {
      label: "Energy deployment proxy",
      value: edgeLabel(overview.energyDeploymentProxyDelta, overview.driverA, overview.driverB),
      note: "Proxy-only speed-shape signal",
      tone: "proxy",
    },
  ];
}

function ModeWorkspace({
  activeTab,
  comparison,
  selectedSession,
  selectedDriverA,
  selectedDriverB,
  selectedSegment,
  selectedSegmentCards,
  chartRows,
  segmentOptions,
  dominanceSegments,
  circuitTrackData,
  dominantEdge,
}: {
  activeTab: AnalyticsTab;
  comparison: AnalyticsComparisonPayload;
  selectedSession: AnalyticsSessionSummary;
  selectedDriverA: string | null;
  selectedDriverB: string | null;
  selectedSegment: SegmentOption | null;
  selectedSegmentCards: MetricCard[];
  chartRows: ChartBar[];
  segmentOptions: SegmentOption[];
  dominanceSegments: AnalyticsDominanceSegment[];
  circuitTrackData: Awaited<ReturnType<typeof getCircuitTrackDataForRace>>;
  dominantEdge: DominantEdge | null;
}) {
  const mode = modeCopy(activeTab);
  const driverA = comparison.overview.driverA;
  const driverB = comparison.overview.driverB;

  if (activeTab === "overview") {
    return (
      <AnalyticsTelemetrySyncScope initialFocusId={dominanceSegments[0]?.segmentId ?? null} label="Overview synchronized telemetry focus">
        <section className="analytics-workspace analytics-workspace--overview" aria-label="Overview telemetry workspace">
          <div className="analytics-workspace__mast">
            <span>{mode.eyebrow}</span>
            <strong>{mode.title}</strong>
            <em>{dominantEdge ? `${dominantEdge.driver} ${dominantEdge.value}` : "No single edge"}</em>
          </div>
          <AnalyticsTrackDominanceMap
            trackData={circuitTrackData}
            segments={dominanceSegments}
            driverA={driverA}
            driverB={driverB}
            title={selectedSession.event}
          />
        </section>
      </AnalyticsTelemetrySyncScope>
    );
  }

  return (
    <AnalyticsTelemetrySyncScope initialFocusId={selectedSegment?.segmentId ?? segmentOptions[0]?.segmentId ?? null} label={`${mode.title} synchronized telemetry focus`}>
      <section className={`analytics-workspace analytics-workspace--${activeTab}`} aria-label={`${mode.title} telemetry workspace`}>
        <div className="analytics-workspace__mast">
          <span>{mode.eyebrow}</span>
          <strong>{mode.title}</strong>
          <em>{mode.note}</em>
        </div>

        <div className="analytics-workspace__grid">
          <TelemetryTraceStack
            rows={chartRows}
            activeTab={activeTab}
            driverA={driverA}
            driverB={driverB}
            selectedSegmentId={selectedSegment?.segmentId ?? null}
            telemetryTraces={comparison.telemetryTraces}
            focusRegions={segmentOptions}
          />

          <aside className="analytics-workspace__side" aria-label={`${mode.title} segment controls`}>
            <div className="analytics-workspace__side-head">
              <span>Mode control</span>
              <strong>{selectedSegment?.label ?? "Approximate segment"}</strong>
            </div>
            {segmentOptions.length > 0 ? (
              <div className="analytics-page__segment-strip analytics-page__segment-strip--command" aria-label="Approximate segment selector">
                {segmentOptions.slice(0, 8).map((segment) => (
                  <a
                    key={segment.segmentId}
                    className={`analytics-page__segment-pill${segment.segmentId === selectedSegment?.segmentId ? " analytics-page__segment-pill--active" : ""}`}
                    data-sync-id={segment.segmentId}
                    href={buildHref({
                      sessionId: selectedSession.id,
                      driverA: selectedDriverA,
                      driverB: selectedDriverB,
                      tab: activeTab,
                      segmentId: segment.segmentId,
                    })}
                  >
                    <i style={{ width: `${Math.max(12, Math.min(100, (segment.confidence ?? 0.35) * 100))}%` }} aria-hidden="true" />
                    <strong>{segment.label}</strong>
                    <span>{segment.kind} - {compactSignalLabel(segment.confidence)}</span>
                  </a>
                ))}
              </div>
            ) : (
              <div className="analytics-page__empty-chart">
                <span>No segment selector</span>
                <p>No prepared rows for this pair.</p>
              </div>
            )}
          </aside>
        </div>

        {selectedSegmentCards.length > 0 ? (
          <div className="analytics-workspace__metrics">
            {selectedSegmentCards.map((card) => (
              <article key={card.label} className={`analytics-page__selected-segment-card${card.tone ? ` analytics-page__selected-segment-card--${card.tone}` : ""}`}>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
                <p>{card.note}</p>
              </article>
            ))}
          </div>
        ) : null}

        <ChartRows rows={chartRows} driverA={driverA} driverB={driverB} selectedSegmentId={selectedSegment?.segmentId ?? null} />

        {activeTab === "energy-proxy" ? (
          <p className="analytics-page__proxy-note">Energy deployment proxy only. Telemetry-derived, not direct energy data.</p>
        ) : null}
      </section>
    </AnalyticsTelemetrySyncScope>
  );
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const params = (await searchParams) ?? {};
  const sessionIdParam = firstParam(params.sessionId);
  const driverAParam = firstParam(params.driverA);
  const driverBParam = firstParam(params.driverB);
  const segmentIdParam = firstParam(params.segmentId);
  const activeTab = normalizeTab(params.tab);
  const comparisonMode: AnalyticsCompareMode = activeTab === "overview" ? "all" : activeTab;
  const [seasonState, sessionResult] = await Promise.all([
    getSeasonState(),
    withServerFallback(
      () => listAnalyticsSessionsResult(),
      { mode: "unavailable" as const, data: null, meta: unavailableRuntime },
      "page:analytics:sessions",
    ),
  ]);
  const sessions = sessionResult.mode === "unavailable" ? [] : sessionResult.data;
  const selectedSession = selectDefaultSession(sessions, sessionIdParam, seasonState);
  const sessionGroups = groupSessions(sessions, seasonState);
  const [drivers, defaultPair] = selectedSession
    ? await Promise.all([
      withServerFallback(() => getAnalyticsDrivers(selectedSession.id), [], "page:analytics:drivers", { sessionId: selectedSession.id }),
      withServerFallback(() => getAnalyticsDefaultDriverPair(selectedSession.id), null, "page:analytics:default-pair", { sessionId: selectedSession.id }),
    ])
    : [[], null] as const;
  const selectedDriverA = drivers.find((driver) => driver.code === driverAParam)?.code
    ?? drivers.find((driver) => driver.code === defaultPair?.driverA)?.code
    ?? drivers[0]?.code
    ?? null;
  const selectedDriverB = drivers.find((driver) => driver.code === driverBParam && driver.code !== selectedDriverA)?.code
    ?? drivers.find((driver) => driver.code === defaultPair?.driverB && driver.code !== selectedDriverA)?.code
    ?? drivers.find((driver) => driver.code !== selectedDriverA)?.code
    ?? null;

  const comparisonResult = selectedSession && selectedDriverA && selectedDriverB
    ? await withServerFallback(
      () => getAnalyticsComparisonResult(selectedSession.id, selectedDriverA, selectedDriverB, comparisonMode),
      { mode: "unavailable" as const, data: null, meta: { ...unavailableRuntime, eventId: selectedSession.id } },
      "page:analytics:comparison",
      { sessionId: selectedSession.id, driverA: selectedDriverA, driverB: selectedDriverB, mode: comparisonMode },
    )
    : null;
  const comparison = comparisonResult?.mode === "unavailable" ? null : comparisonResult?.data ?? null;
  const metricCards = comparison ? buildMetricCards(comparison) : [];
  const telemetryInstruments = comparison ? buildTelemetryInstruments(comparison) : [];
  const segmentOptions = comparison ? buildSegmentOptions(comparison, activeTab) : [];
  const selectedSegment = segmentOptions.find((segment) => segment.segmentId === segmentIdParam) ?? segmentOptions[0] ?? null;
  const selectedSegmentCards = comparison ? selectedSegmentMetrics(comparison, activeTab, selectedSegment?.segmentId ?? null) : [];
  const chartRows = comparison ? activeChartRows(comparison, activeTab) : [];
  const dominantEdge = comparison ? buildDominantEdge(comparison) : null;
  const dominanceSegments = comparison ? buildDominanceSegments(comparison) : [];
  const engineerInsights = comparison ? buildEngineerInsights(comparison, dominantEdge) : [];
  const teamStyle = buildTeamStyle(comparison);
  const circuitTrackData = selectedSession ? await getCircuitTrackDataForRace(selectedSession.season, selectedSession.round) : null;
  const confidenceLabel = comparison ? confidenceTier(comparison.overview.confidence, comparison.session.telemetryQualityMean) : "Incomplete session confidence";
  const telemetryLabel = telemetryQualityTier(selectedSession?.telemetryQualityMean);
  const latestTelemetryLabel = formatSeasonRaceLabel(seasonState?.latest_completed_race_with_analytics);
  const selectedSessionIsLatestTelemetry = selectedSession?.season === seasonState?.latest_completed_race_with_analytics?.season
    && selectedSession?.round === seasonState?.latest_completed_race_with_analytics?.round;

  return (
    <main className="analytics-page analytics-page--battle-station" style={teamStyle}>
      <AppHeader title="Analytics" actionHref="/lab" actionLabel="Strategy Lab" compact />
      <header className="analytics-page__hero">
        <div className="analytics-page__hero-body">
          <div className="analytics-page__hero-copy">
            <p className="strategy-lab-page__eyebrow">Telemetry workstation</p>
            <h1 className="analytics-page__title">Telemetry battle station.</h1>
            <p className="analytics-page__lede">{selectedSession ? `${selectedSession.event} ${selectedSession.session} - telemetry-derived, approximate segment comparison.` : "Telemetry-derived driver comparison."}</p>
          </div>

          {comparison && dominantEdge ? (
            <div className="analytics-page__hero-battle" aria-label="Driver battle summary">
              <div className="analytics-page__hero-driver analytics-page__hero-driver--a">
                <span>{comparison.overview.driverATeam ?? "Driver A"}</span>
                <strong>{comparison.overview.driverA}</strong>
              </div>
              <div className="analytics-page__hero-edge">
                <span>{dominantEdge.label}</span>
                <strong>{dominantEdge.driver}</strong>
                <b>{dominantEdge.value}</b>
              </div>
              <div className="analytics-page__hero-driver analytics-page__hero-driver--b analytics-page__hero-driver--right">
                <span>{comparison.overview.driverBTeam ?? "Driver B"}</span>
                <strong>{comparison.overview.driverB}</strong>
              </div>
            </div>
          ) : null}

          <div className="analytics-page__hero-rail">
            <div className="analytics-page__hero-card">
              <span>Completed race</span>
              <strong>{formatSeasonRaceLabel(seasonState?.latest_completed_race)}</strong>
              <p>{seasonState?.missing_data_flags.includes("latest_completed_results_missing") ? "Results pending" : "Results ready"}</p>
            </div>
              <div className="analytics-page__hero-card">
                <span>Next race</span>
                <strong>{formatSeasonRaceLabel(seasonState?.next_race)}</strong>
                <p>{seasonState?.current_race_week.available ? "Race Week ready" : "No telemetry yet"}</p>
              </div>
              <div className="analytics-page__hero-card analytics-page__hero-card--strength">
                <span>Latest telemetry</span>
                <strong>{latestTelemetryLabel || (selectedSession ? `${selectedSession.event} ${selectedSession.session}` : "Unavailable")}</strong>
                <p>{selectedSessionIsLatestTelemetry ? telemetryLabel : "Select latest race"}</p>
              </div>
          </div>
          <ProductRuntimeNote runtime={sessionResult.meta} className="analytics-page__runtime" primaryLabel="Analytics data" />
        </div>
      </header>

      {selectedSession ? (
        <>
          <section className="analytics-page__controls">
            <div className="analytics-page__section-header">
              <span>Setup</span>
              <h2>{selectedSessionIsLatestTelemetry ? "Latest telemetry loaded." : "Session and pair."}</h2>
            </div>

            <form className="analytics-page__form" action="/analytics">
              <label className="analytics-page__field">
                <span>Session</span>
                <select name="sessionId" defaultValue={selectedSession.id}>
                  {sessionGroups.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.sessions.map((session) => (
                        <option key={session.id} value={session.id}>
                          {sessionLabel(session)}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>

              <label className="analytics-page__field">
                <span>Driver A</span>
                <select name="driverA" defaultValue={selectedDriverA ?? ""}>
                  {drivers.map((driver) => (
                    <option key={driver.code} value={driver.code}>
                      {driver.code}{driver.team ? ` - ${driver.team}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="analytics-page__field">
                <span>Driver B</span>
                <select name="driverB" defaultValue={selectedDriverB ?? ""}>
                  {drivers.map((driver) => (
                    <option key={driver.code} value={driver.code}>
                      {driver.code}{driver.team ? ` - ${driver.team}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <input type="hidden" name="tab" value={activeTab} />
              <button className="analytics-page__submit" type="submit">Load comparison</button>
            </form>
          </section>

          {comparison ? (
            <section className="analytics-page__results">
              <div className="analytics-page__driver-strip" aria-label="Selected driver comparison">
                <article className="analytics-page__driver-card analytics-page__driver-card--a">
                  <span>Driver A</span>
                  <strong>{comparison.overview.driverA}</strong>
                  <TeamBadge teamId={normalizeTeamId(comparison.overview.driverATeam)} label={comparison.overview.driverATeam ?? "Constructor"} compact />
                </article>
                <div className="analytics-page__versus">vs</div>
                <article className="analytics-page__driver-card analytics-page__driver-card--b">
                  <span>Driver B</span>
                  <strong>{comparison.overview.driverB}</strong>
                  <TeamBadge teamId={normalizeTeamId(comparison.overview.driverBTeam)} label={comparison.overview.driverBTeam ?? "Constructor"} compact />
                </article>
                <article className="analytics-page__strength-card">
                  <span>Agreement</span>
                  <strong>{confidenceLabel}</strong>
                  <div className="analytics-page__strength-meter" aria-label={confidenceLabel}>
                    <i style={{ width: `${Math.round(Math.min(comparison.session.telemetryQualityMean ?? 0, comparison.overview.confidence ?? 0) * 100)}%` }} />
                  </div>
                  <p>{telemetryLabel}</p>
                </article>
              </div>

              <nav className="analytics-page__tabs analytics-page__tabs--command" aria-label="Analytics telemetry systems">
                {analyticsTabs.map((tab) => (
                  <a
                    key={tab.id}
                    className={`analytics-page__tab${tab.id === activeTab ? " analytics-page__tab--active" : ""}`}
                    href={buildHref({
                      sessionId: selectedSession.id,
                      driverA: selectedDriverA,
                      driverB: selectedDriverB,
                      tab: tab.id,
                      segmentId: null,
                    })}
                    aria-current={tab.id === activeTab ? "page" : undefined}
                  >
                    <span>{tab.shortLabel}</span>
                    <strong>{tab.label}</strong>
                  </a>
                ))}
              </nav>

              <ModeWorkspace
                activeTab={activeTab}
                comparison={comparison}
                selectedSession={selectedSession}
                selectedDriverA={selectedDriverA}
                selectedDriverB={selectedDriverB}
                selectedSegment={selectedSegment}
                selectedSegmentCards={selectedSegmentCards}
                chartRows={chartRows}
                segmentOptions={segmentOptions}
                dominanceSegments={dominanceSegments}
                circuitTrackData={circuitTrackData}
                dominantEdge={dominantEdge}
              />

              {dominantEdge ? (
                <div className={`analytics-page__edge-hero${dominantEdge.tone ? ` analytics-page__edge-hero--${dominantEdge.tone}` : ""}`}>
                  <div>
                    <span>Dominant telemetry edge</span>
                    <strong>{dominantEdge.driver}</strong>
                  </div>
                  <div>
                    <em>{dominantEdge.label}</em>
                    <b>{dominantEdge.value}</b>
                    <p>{dominantEdge.note}</p>
                  </div>
                </div>
              ) : null}

              <div className="analytics-page__instrument-grid" aria-label="Telemetry instruments">
                {telemetryInstruments.map((instrument) => (
                  <article key={instrument.label} className={`analytics-page__instrument analytics-page__instrument--${instrument.tone ?? "speed"}`}>
                    <div>
                      <span>{instrument.label}</span>
                      <strong>{instrument.value}</strong>
                    </div>
                    <b>{instrument.leader}</b>
                    <div className="analytics-page__instrument-rail" aria-hidden="true">
                      <i style={{ width: `${instrument.fill}%` }} />
                    </div>
                  </article>
                ))}
              </div>

              <div className="analytics-page__metric-grid">
                {metricCards.map((card) => (
                  <article key={card.label} className={`analytics-page__metric-card${card.tone ? ` analytics-page__metric-card--${card.tone}` : ""}`}>
                    <span>{card.label}</span>
                    <strong>{card.value}</strong>
                    <p>{card.note}</p>
                  </article>
                ))}
              </div>

              <section className="analytics-page__engineer-insights" aria-label="Race engineer insights">
                <div className="analytics-page__section-header">
                  <span>Race engineer insights</span>
                  <h2>Battle read.</h2>
                </div>
                <div className="analytics-page__insight-grid">
                  {engineerInsights.map((insight) => (
                    <article key={insight.label} className={`analytics-page__insight-chip${insight.tone ? ` analytics-page__insight-chip--${insight.tone}` : ""}`}>
                      <span>{insight.label}</span>
                      <strong>{insight.value}</strong>
                      <p>{insight.note}</p>
                    </article>
                  ))}
                </div>
              </section>

              <div className="analytics-page__trust-grid">
                <article className="analytics-page__trust-card">
                  <span>Track context</span>
                  <strong>{comparison.trackSummary?.trackArchetype ?? selectedSession.trackArchetype}</strong>
                  <p>{comparison.trackSummary ? confidenceTier(comparison.trackSummary.archetypeConfidence) : "Track weighting unavailable"}</p>
                </article>
                <article className="analytics-page__trust-card">
                  <span>Weakest assumption</span>
                  <strong>Approximate segments</strong>
                  <p>{comparison.overview.weakestAssumption}</p>
                </article>
                <article className="analytics-page__trust-card analytics-page__trust-card--proxy">
                  <span>Energy deployment proxy</span>
                  <strong>Proxy only</strong>
                  <p>Telemetry-derived speed shape.</p>
                </article>
              </div>

            </section>
          ) : (
            <StatePanel
              eyebrow="Analytics"
              title="No comparison is available for this selection."
              message="Choose two different drivers from a validated session."
              tone="notice"
            />
          )}
        </>
      ) : (
        <StatePanel
          eyebrow="Analytics"
          title="Analytics data is unavailable."
          message="Analytics data is unavailable."
          tone="error"
          actionHref="/"
          actionLabel="Back to homepage"
        />
      )}

      <SiteFooter />
    </main>
  );
}
