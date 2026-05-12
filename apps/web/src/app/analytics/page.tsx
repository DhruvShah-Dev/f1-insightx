import { AppHeader } from "@/components/ui/app-header";
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
  type AnalyticsThrottleHighlight,
} from "@/lib/server/analytics-product";
import { formatSeasonRaceLabel, getSeasonState, type SeasonState } from "@/lib/server/season-state";
import type { RuntimeSourceMetadata } from "@/lib/server/runtime-source";

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

const analyticsTabs: Array<{ id: AnalyticsTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "segments", label: "Segments" },
  { id: "braking", label: "Braking" },
  { id: "throttle", label: "Throttle" },
  { id: "straights", label: "Straights" },
  { id: "energy-proxy", label: "Energy proxy" },
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
          <div className={`analytics-chart__row${row.segmentId === selectedSegmentId ? " analytics-chart__row--selected" : ""}`} key={row.label}>
            <div className="analytics-chart__meta">
              <strong>{row.label}</strong>
              <span>{row.segmentId === selectedSegmentId ? "Selected - " : ""}{confidenceTier(row.confidence)}</span>
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

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const params = (await searchParams) ?? {};
  const sessionIdParam = firstParam(params.sessionId);
  const driverAParam = firstParam(params.driverA);
  const driverBParam = firstParam(params.driverB);
  const segmentIdParam = firstParam(params.segmentId);
  const activeTab = normalizeTab(params.tab);
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
      () => getAnalyticsComparisonResult(selectedSession.id, selectedDriverA, selectedDriverB, activeTab),
      { mode: "unavailable" as const, data: null, meta: { ...unavailableRuntime, eventId: selectedSession.id } },
      "page:analytics:comparison",
      { sessionId: selectedSession.id, driverA: selectedDriverA, driverB: selectedDriverB },
    )
    : null;
  const comparison = comparisonResult?.mode === "unavailable" ? null : comparisonResult?.data ?? null;
  const metricCards = comparison ? buildMetricCards(comparison) : [];
  const segmentOptions = comparison ? buildSegmentOptions(comparison, activeTab) : [];
  const selectedSegment = segmentOptions.find((segment) => segment.segmentId === segmentIdParam) ?? segmentOptions[0] ?? null;
  const selectedSegmentCards = comparison ? selectedSegmentMetrics(comparison, activeTab, selectedSegment?.segmentId ?? null) : [];
  const chartRows = comparison ? activeChartRows(comparison, activeTab) : [];
  const selectedTabLabel = analyticsTabs.find((tab) => tab.id === activeTab)?.label ?? "Overview";
  const dominantEdge = comparison ? buildDominantEdge(comparison) : null;
  const confidenceLabel = comparison ? confidenceTier(comparison.overview.confidence, comparison.session.telemetryQualityMean) : "Incomplete session confidence";
  const telemetryLabel = telemetryQualityTier(selectedSession?.telemetryQualityMean);
  const latestTelemetryLabel = formatSeasonRaceLabel(seasonState?.latest_completed_race_with_analytics);
  const selectedSessionIsLatestTelemetry = selectedSession?.season === seasonState?.latest_completed_race_with_analytics?.season
    && selectedSession?.round === seasonState?.latest_completed_race_with_analytics?.round;

  return (
    <main className="analytics-page">
      <AppHeader title="Analytics" actionHref="/lab" actionLabel="Strategy Lab" compact />
      <header className="analytics-page__hero">
        <div className="analytics-page__hero-body">
          <div className="analytics-page__hero-copy">
            <p className="strategy-lab-page__eyebrow">Telemetry workstation</p>
            <h1 className="analytics-page__title">Driver edge, by signal.</h1>
            <p className="analytics-page__lede">Telemetry-derived comparisons across approximate segments, race pace signals, and energy deployment proxy.</p>
          </div>

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

              <div className="analytics-page__metric-grid">
                {metricCards.map((card) => (
                  <article key={card.label} className={`analytics-page__metric-card${card.tone ? ` analytics-page__metric-card--${card.tone}` : ""}`}>
                    <span>{card.label}</span>
                    <strong>{card.value}</strong>
                    <p>{card.note}</p>
                  </article>
                ))}
              </div>

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

              <nav className="analytics-page__tabs" aria-label="Analytics comparison modes">
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
                    {tab.label}
                  </a>
                ))}
              </nav>

              {activeTab !== "overview" ? (
                <section className="analytics-page__segment-workbench">
                  <div className="analytics-page__section-header">
                    <span>{selectedTabLabel} selector</span>
                    <h2>Approx segment focus.</h2>
                  </div>
                  {segmentOptions.length > 0 ? (
                    <>
                      <div className="analytics-page__segment-strip" aria-label="Approximate segment selector">
                        {segmentOptions.map((segment) => (
                          <a
                            key={segment.segmentId}
                            className={`analytics-page__segment-pill${segment.segmentId === selectedSegment?.segmentId ? " analytics-page__segment-pill--active" : ""}`}
                            href={buildHref({
                              sessionId: selectedSession.id,
                              driverA: selectedDriverA,
                              driverB: selectedDriverB,
                              tab: activeTab,
                              segmentId: segment.segmentId,
                            })}
                          >
                            <strong>{segment.label}</strong>
                            <span>{segment.kind} - {confidenceTier(segment.confidence)}</span>
                          </a>
                        ))}
                      </div>
                      {selectedSegment ? (
                        <div className="analytics-page__selected-segment">
                          <article className="analytics-page__selected-segment-card">
                            <span>Selected segment</span>
                            <strong>{selectedSegment.label}</strong>
                            <p>{selectedSegment.kind} - {confidenceTier(selectedSegment.confidence)}.</p>
                          </article>
                          {selectedSegmentCards.map((card) => (
                            <article key={card.label} className={`analytics-page__selected-segment-card${card.tone ? ` analytics-page__selected-segment-card--${card.tone}` : ""}`}>
                              <span>{card.label}</span>
                              <strong>{card.value}</strong>
                              <p>{card.note}</p>
                            </article>
                          ))}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="analytics-page__empty-chart">
                      <span>No segment selector</span>
                      <p>No prepared rows for this pair.</p>
                    </div>
                  )}
                </section>
              ) : null}

              {activeTab === "segments" ? (
                <section className="analytics-page__detail-panel">
                  <div className="analytics-page__section-header">
                    <span>Segment speed delta</span>
                    <h2>Speed delta.</h2>
                  </div>
                  <ChartRows rows={chartRows} driverA={comparison.overview.driverA} driverB={comparison.overview.driverB} selectedSegmentId={selectedSegment?.segmentId ?? null} />
                </section>
              ) : null}

              {activeTab === "braking" ? (
                <section className="analytics-page__detail-panel">
                  <div className="analytics-page__section-header">
                    <span>Braking delta</span>
                    <h2>Late-brake signal.</h2>
                  </div>
                  <ChartRows rows={chartRows} driverA={comparison.overview.driverA} driverB={comparison.overview.driverB} selectedSegmentId={selectedSegment?.segmentId ?? null} />
                </section>
              ) : null}

              {activeTab === "throttle" ? (
                <section className="analytics-page__detail-panel">
                  <div className="analytics-page__section-header">
                    <span>Throttle and traction</span>
                    <h2>Exit signal.</h2>
                  </div>
                  <ChartRows rows={chartRows} driverA={comparison.overview.driverA} driverB={comparison.overview.driverB} selectedSegmentId={selectedSegment?.segmentId ?? null} />
                </section>
              ) : null}

              {activeTab === "straights" ? (
                <section className="analytics-page__detail-panel">
                  <div className="analytics-page__section-header">
                    <span>Straight-line delta</span>
                    <h2>Terminal speed.</h2>
                  </div>
                  <ChartRows rows={chartRows} driverA={comparison.overview.driverA} driverB={comparison.overview.driverB} selectedSegmentId={selectedSegment?.segmentId ?? null} />
                </section>
              ) : null}

              {activeTab === "energy-proxy" ? (
                <section className="analytics-page__detail-panel analytics-page__detail-panel--proxy">
                  <div className="analytics-page__section-header">
                    <span>Energy deployment proxy</span>
                    <h2>Proxy signal.</h2>
                  </div>
                  <ChartRows rows={chartRows} driverA={comparison.overview.driverA} driverB={comparison.overview.driverB} selectedSegmentId={selectedSegment?.segmentId ?? null} />
                  <p className="analytics-page__proxy-note">Energy deployment proxy only. Telemetry-derived, not direct energy data.</p>
                </section>
              ) : null}
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
