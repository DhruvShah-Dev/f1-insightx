import { AnalyticsTrackDominanceMap, type AnalyticsDominanceSegment } from "@/components/analytics/analytics-track-dominance-map";
import { AnalyticsTelemetrySyncScope } from "@/components/analytics/analytics-telemetry-sync-scope";
import { ProductRuntimeNote } from "@/components/ui/product-runtime-note";
import { SiteFooter } from "@/components/ui/site-footer";
import { StatePanel } from "@/components/ui/state-panel";
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
import { getSeasonState, type SeasonState } from "@/lib/server/season-state";
import type { RuntimeSourceMetadata } from "@/lib/server/runtime-source";
import { getTeamMeta } from "@/lib/ui/team-meta";
import type { CSSProperties, ReactNode } from "react";

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

type SameTeamComparisonPalette = {
  driverB: string;
  driverBSecondary: string;
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

const sameTeamComparisonPalettes: Record<string, SameTeamComparisonPalette> = {
  mclaren: { driverB: "#89f0ff", driverBSecondary: "#f5f7fb" },
  ferrari: { driverB: "#ffda59", driverBSecondary: "#ffffff" },
  mercedes: { driverB: "#d9dde3", driverBSecondary: "#7ef5e7" },
  red_bull: { driverB: "#f5c542", driverBSecondary: "#ffffff" },
};

const analyticsTeamAliases: Record<string, string> = {
  red_bull_racing: "red_bull",
  haas_f1_team: "haas",
  rb: "racing_bulls",
  alphatauri: "racing_bulls",
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeTeamId(team: string | null | undefined) {
  const normalized = (team ?? "constructor").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return analyticsTeamAliases[normalized] ?? normalized;
}

function isSameTeamComparison(comparison: AnalyticsComparisonPayload | null) {
  if (!comparison?.overview.driverATeam || !comparison.overview.driverBTeam) return false;
  return normalizeTeamId(comparison.overview.driverATeam) === normalizeTeamId(comparison.overview.driverBTeam);
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

function formatCompactSigned(value: number | null | undefined, unit = "") {
  if (value === null || value === undefined || !Number.isFinite(value)) return "n/a";
  if (Math.abs(value) < 0.0001) return `0${unit}`;
  return `${value > 0 ? "+" : ""}${value.toFixed(Math.abs(value) >= 10 ? 1 : 2)}${unit}`;
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
  const teamAId = normalizeTeamId(comparison?.overview.driverATeam);
  const teamBId = normalizeTeamId(comparison?.overview.driverBTeam);
  const teamA = getTeamMeta(teamAId);
  const teamB = getTeamMeta(teamBId);
  const sameTeam = isSameTeamComparison(comparison);
  const sameTeamPalette = sameTeamComparisonPalettes[teamAId];
  const driverBPrimary = sameTeam
    ? sameTeamPalette?.driverB ?? teamB.secondary ?? teamB.accent ?? "#e10600"
    : teamB.primary;
  const driverBSecondary = sameTeam
    ? sameTeamPalette?.driverBSecondary ?? teamB.accent ?? teamB.secondary ?? "#f5f7fb"
    : teamB.secondary;

  return {
    "--team-a": teamA.primary,
    "--team-a-secondary": teamA.secondary,
    "--team-b": driverBPrimary,
    "--team-b-secondary": driverBSecondary,
    "--same-team-comparison": sameTeam ? 1 : 0,
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

function AnalyticsCommandDeck({
  selectedSession,
  sessionGroups,
  drivers,
  selectedDriverA,
  selectedDriverB,
  activeTab,
  runtime,
}: {
  selectedSession: AnalyticsSessionSummary;
  sessionGroups: Array<{ label: string; sessions: AnalyticsSessionSummary[] }>;
  drivers: ReadonlyArray<{ code: string; team: string | null }>;
  selectedDriverA: string | null;
  selectedDriverB: string | null;
  activeTab: AnalyticsTab;
  runtime: RuntimeSourceMetadata;
}) {
  return (
    <section className="analytics-command-deck" aria-label="Analytics telemetry command deck">
      <div className="analytics-command-deck__identity">
        <span>Telemetry workstation</span>
        <strong>{selectedSession.event}</strong>
        <em>{selectedSession.session} / Approximate segment comparison</em>
      </div>

      <form className="analytics-command-deck__form" action="/analytics">
        <label>
          <span>Session</span>
          <select name="sessionId" defaultValue={selectedSession.id}>
            {sessionGroups.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.sessions.map((session) => (
                  <option key={session.id} value={session.id}>{sessionLabel(session)}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label>
          <span>Driver A</span>
          <select name="driverA" defaultValue={selectedDriverA ?? ""}>
            {drivers.map((driver) => (
              <option key={driver.code} value={driver.code}>{driver.code}{driver.team ? ` - ${driver.team}` : ""}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Driver B</span>
          <select name="driverB" defaultValue={selectedDriverB ?? ""}>
            {drivers.map((driver) => (
              <option key={driver.code} value={driver.code}>{driver.code}{driver.team ? ` - ${driver.team}` : ""}</option>
            ))}
          </select>
        </label>
        <input type="hidden" name="tab" value={activeTab} />
        <button type="submit">Load comparison</button>
      </form>

      <nav className="analytics-command-deck__modes" aria-label="Analytics telemetry systems">
        {analyticsTabs.map((tab) => (
          <a
            key={tab.id}
            className={tab.id === activeTab ? "is-active" : ""}
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

      <ProductRuntimeNote runtime={runtime} className="analytics-command-deck__runtime" primaryLabel="Analytics data" />
    </section>
  );
}

function modeInstrumentSelection(activeTab: AnalyticsTab, instruments: TelemetryInstrument[]) {
  const preferred = activeTab === "braking"
    ? ["Brake", "Speed", "Traction"]
    : activeTab === "throttle" || activeTab === "segments"
      ? ["Traction", "Speed", "Brake"]
      : activeTab === "straights"
        ? ["Speed", "Energy proxy", "Traction"]
        : activeTab === "energy-proxy"
          ? ["Energy proxy", "Speed", "Traction"]
          : ["Speed", "Brake", "Traction"];
  return preferred.map((label) => instruments.find((instrument) => instrument.label === label)).filter((instrument): instrument is TelemetryInstrument => Boolean(instrument));
}

function AnalyticsBattleRail({
  comparison,
  dominantEdge,
  instruments,
  activeTab,
  telemetryLabel,
}: {
  comparison: AnalyticsComparisonPayload;
  dominantEdge: DominantEdge;
  instruments: TelemetryInstrument[];
  activeTab: AnalyticsTab;
  telemetryLabel: string;
}) {
  const modeInstruments = modeInstrumentSelection(activeTab, instruments);
  const sameTeam = isSameTeamComparison(comparison);
  return (
    <aside className="analytics-battle-rail" aria-label="Driver telemetry battle">
      <div className="analytics-battle-rail__drivers">
        <div className="analytics-battle-rail__driver analytics-battle-rail__driver--a">
          <span>{comparison.overview.driverATeam ?? "Driver A"}</span>
          <strong>{comparison.overview.driverA}</strong>
        </div>
        <div className="analytics-battle-rail__versus">VS</div>
        <div className="analytics-battle-rail__driver analytics-battle-rail__driver--b">
          <span>{comparison.overview.driverBTeam ?? "Driver B"}</span>
          <strong>{comparison.overview.driverB}</strong>
        </div>
      </div>
      {sameTeam ? <div className="analytics-battle-rail__same-team">Same constructor comparison colors</div> : null}
      <div className="analytics-battle-rail__edge">
        <span>{dominantEdge.label}</span>
        <strong>{dominantEdge.driver}</strong>
        <b>{dominantEdge.value}</b>
        <p>{dominantEdge.note}</p>
      </div>
      <div className="analytics-battle-rail__instruments">
        {modeInstruments.map((instrument) => (
          <div key={instrument.label} className={`analytics-battle-rail__instrument analytics-battle-rail__instrument--${instrument.tone ?? "speed"}`}>
            <span>{instrument.label}</span>
            <strong>{instrument.value}</strong>
            <em>{instrument.leader}</em>
            <i aria-hidden="true"><b style={{ width: `${instrument.fill}%` }} /></i>
          </div>
        ))}
      </div>
      <div className="analytics-battle-rail__quality">
        <span>Data quality</span>
        <strong>{telemetryLabel}</strong>
      </div>
    </aside>
  );
}

function AnalyticsAdaptiveCanvas({ children, battleRail, activeTab }: { children: ReactNode; battleRail: ReactNode; activeTab: AnalyticsTab }) {
  return (
    <section className={`analytics-adaptive-canvas analytics-adaptive-canvas--${activeTab}`}>
      <div className="analytics-adaptive-canvas__main">{children}</div>
      {battleRail}
    </section>
  );
}

function AnalyticsEngineeringStrip({
  comparison,
  dominantEdge,
  activeTab,
  telemetryLabel,
}: {
  comparison: AnalyticsComparisonPayload;
  dominantEdge: DominantEdge;
  activeTab: AnalyticsTab;
  telemetryLabel: string;
}) {
  return (
    <section className="analytics-engineering-strip" aria-label="Race engineer telemetry read">
      <article>
        <span>Strongest area</span>
        <strong>{dominantEdge.label}</strong>
        <p>{dominantEdge.driver} {dominantEdge.value}</p>
      </article>
      <article>
        <span>Weakest assumption</span>
        <strong>Approximate segment mapping</strong>
        <p>{comparison.overview.weakestAssumption}</p>
      </article>
      <article>
        <span>Data status</span>
        <strong>{telemetryLabel}</strong>
        <p>Representative telemetry and deterministic product views.</p>
      </article>
      <article className={activeTab === "energy-proxy" ? "is-proxy-active" : ""}>
        <span>Energy deployment proxy</span>
        <strong>Proxy only</strong>
        <p>Telemetry-derived speed shape, not true ERS or battery state.</p>
      </article>
    </section>
  );
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

        <div className="analytics-workspace__trace-stage">
          <TelemetryTraceStack
            rows={chartRows}
            activeTab={activeTab}
            driverA={driverA}
            driverB={driverB}
            selectedSegmentId={selectedSegment?.segmentId ?? null}
            telemetryTraces={comparison.telemetryTraces}
            focusRegions={segmentOptions}
          />
        </div>

        {segmentOptions.length > 0 ? (
          <nav className="analytics-workspace__segment-rail" aria-label="Approximate segment selector">
            {segmentOptions.slice(0, 10).map((segment, index) => (
              <a
                key={segment.segmentId}
                className={segment.segmentId === selectedSegment?.segmentId ? "is-active" : ""}
                data-sync-id={segment.segmentId}
                href={buildHref({
                  sessionId: selectedSession.id,
                  driverA: selectedDriverA,
                  driverB: selectedDriverB,
                  tab: activeTab,
                  segmentId: segment.segmentId,
                })}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{segment.kind}</strong>
                <em>{compactSignalLabel(segment.confidence)}</em>
              </a>
            ))}
          </nav>
        ) : null}

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
  const telemetryInstruments = comparison ? buildTelemetryInstruments(comparison) : [];
  const segmentOptions = comparison ? buildSegmentOptions(comparison, activeTab) : [];
  const selectedSegment = segmentOptions.find((segment) => segment.segmentId === segmentIdParam) ?? segmentOptions[0] ?? null;
  const selectedSegmentCards = comparison ? selectedSegmentMetrics(comparison, activeTab, selectedSegment?.segmentId ?? null) : [];
  const chartRows = comparison ? activeChartRows(comparison, activeTab) : [];
  const dominantEdge = comparison ? buildDominantEdge(comparison) : null;
  const dominanceSegments = comparison ? buildDominanceSegments(comparison) : [];
  const teamStyle = buildTeamStyle(comparison);
  const circuitTrackData = selectedSession ? await getCircuitTrackDataForRace(selectedSession.season, selectedSession.round) : null;
  const telemetryLabel = telemetryQualityTier(selectedSession?.telemetryQualityMean);

  return (
    <main className="analytics-page analytics-page--adaptive-workstation" style={teamStyle}>
      {selectedSession ? (
        <>
          <AnalyticsCommandDeck
            selectedSession={selectedSession}
            sessionGroups={sessionGroups}
            drivers={drivers}
            selectedDriverA={selectedDriverA}
            selectedDriverB={selectedDriverB}
            activeTab={activeTab}
            runtime={sessionResult.meta}
          />

          {comparison ? (
            <>
              <section className="analytics-workstation-stage">
                <AnalyticsAdaptiveCanvas
                  activeTab={activeTab}
                  battleRail={dominantEdge ? (
                    <AnalyticsBattleRail
                      comparison={comparison}
                      dominantEdge={dominantEdge}
                      instruments={telemetryInstruments}
                      activeTab={activeTab}
                      telemetryLabel={telemetryLabel}
                    />
                  ) : null}
                >
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
                </AnalyticsAdaptiveCanvas>
              </section>
              {dominantEdge ? (
                <AnalyticsEngineeringStrip
                  comparison={comparison}
                  dominantEdge={dominantEdge}
                  activeTab={activeTab}
                  telemetryLabel={telemetryLabel}
                />
              ) : null}
            </>
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
