import { HomeLink } from "@/components/ui/home-link";
import { ProductRuntimeNote } from "@/components/ui/product-runtime-note";
import { SiteFooter } from "@/components/ui/site-footer";
import { StatePanel } from "@/components/ui/state-panel";
import { TeamBadge } from "@/components/ui/team-badge";
import { withServerFallback } from "@/lib/errors/logger";
import {
  getAnalyticsComparisonResult,
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

const analyticsTabs: Array<{ id: AnalyticsTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "segments", label: "Segments" },
  { id: "braking", label: "Braking" },
  { id: "throttle", label: "Throttle" },
  { id: "straights", label: "Straights" },
  { id: "energy-proxy", label: "Energy Proxy" },
];

const unavailableRuntime: RuntimeSourceMetadata = {
  surface: "analytics",
  mode: "unavailable",
  sourceKind: null,
  sourceLabel: null,
  reason: "Analytics product views failed to load.",
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

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return "n/a";
  return `${Math.round(value * 100)}%`;
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
      value: comparison.dataStrengthLabel,
      note: `${formatPercent(overview.confidence)} comparison confidence`,
    },
  ];
}

function sessionLabel(session: AnalyticsSessionSummary) {
  return `${session.season} R${session.round} ${session.event} - ${session.session}`;
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
        <p>This comparison mode has no capped product-view rows for the selected pair.</p>
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
              <span>{row.segmentId === selectedSegmentId ? "Selected | " : ""}{formatPercent(row.confidence)} confidence</span>
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

  const sessionResult = await withServerFallback(
    () => listAnalyticsSessionsResult(),
    { mode: "unavailable" as const, data: null, meta: unavailableRuntime },
    "page:analytics:sessions",
  );
  const sessions = sessionResult.mode === "unavailable" ? [] : sessionResult.data;
  const selectedSession = sessions.find((session) => session.id === sessionIdParam) ?? sessions[0] ?? null;
  const drivers = selectedSession ? await withServerFallback(() => getAnalyticsDrivers(selectedSession.id), [], "page:analytics:drivers", { sessionId: selectedSession.id }) : [];
  const selectedDriverA = drivers.find((driver) => driver.code === driverAParam)?.code ?? drivers[0]?.code ?? null;
  const selectedDriverB = drivers.find((driver) => driver.code === driverBParam && driver.code !== selectedDriverA)?.code ?? drivers.find((driver) => driver.code !== selectedDriverA)?.code ?? null;

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

  return (
    <main className="analytics-page">
      <header className="analytics-page__hero">
        <div className="strategy-lab-page__topbar">
          <div className="strategy-lab-page__kicker">
            <span>Analytics</span>
            <strong>Telemetry product views</strong>
          </div>
          <HomeLink />
        </div>

        <div className="analytics-page__hero-body">
          <div className="analytics-page__hero-copy">
            <p className="strategy-lab-page__eyebrow">Driver comparison</p>
            <h1 className="analytics-page__title">Compare pace signals without raw telemetry noise.</h1>
            <p className="analytics-page__lede">
              Segment, braking, traction, straight-line, DRS, and energy deployment proxy signals from precomputed Analytics views.
            </p>
          </div>

          <div className="analytics-page__hero-rail">
            <div className="analytics-page__hero-card">
              <span>Sessions</span>
              <strong>{sessions.length}</strong>
              <p>Only validated Analytics product views are served at runtime.</p>
            </div>
              <div className="analytics-page__hero-card">
                <span>Selected</span>
                <strong>{selectedSession ? `${selectedSession.event} ${selectedSession.session}` : "Unavailable"}</strong>
                <p>{selectedSession ? `${selectedSession.driverCount} drivers | ${selectedSession.segmentCount} approximate segments` : "No Analytics session index is available."}</p>
              </div>
              <div className="analytics-page__hero-card analytics-page__hero-card--strength">
                <span>Telemetry quality</span>
                <strong>{formatPercent(selectedSession?.telemetryQualityMean)}</strong>
                <p>{selectedSession ? `${selectedSession.trackArchetype} context with product-view freshness metadata.` : "Waiting for validated product data."}</p>
              </div>
          </div>
          <ProductRuntimeNote runtime={sessionResult.meta} className="analytics-page__runtime" primaryLabel="Analytics product views" />
        </div>
      </header>

      {selectedSession ? (
        <>
          <section className="analytics-page__controls">
            <div className="analytics-page__section-header">
              <span>Comparison setup</span>
              <h2>Pick a session and two drivers.</h2>
            </div>

            <form className="analytics-page__form" action="/analytics">
              <label className="analytics-page__field">
                <span>Session</span>
                <select name="sessionId" defaultValue={selectedSession.id}>
                  {sessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {sessionLabel(session)}
                    </option>
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
              <div className="analytics-page__insight">
                <span>Primary insight</span>
                <strong>{comparison.primaryInsight}</strong>
                <p>{comparison.overview.strategyRelevanceNote}</p>
              </div>

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
                  <span>Data strength</span>
                  <strong>{comparison.dataStrengthLabel}</strong>
                  <div className="analytics-page__strength-meter" aria-label={`Telemetry quality ${formatPercent(comparison.session.telemetryQualityMean)}`}>
                    <i style={{ width: `${Math.round(Math.min(comparison.session.telemetryQualityMean ?? 0, comparison.overview.confidence ?? 0) * 100)}%` }} />
                  </div>
                  <p>{formatPercent(comparison.session.telemetryQualityMean)} telemetry quality | {formatPercent(comparison.overview.confidence)} confidence</p>
                </article>
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

              <div className="analytics-page__trust-grid">
                <article className="analytics-page__trust-card">
                  <span>Track context</span>
                  <strong>{comparison.trackSummary?.trackArchetype ?? selectedSession.trackArchetype}</strong>
                  <p>{comparison.trackSummary ? `${formatPercent(comparison.trackSummary.archetypeConfidence)} archetype confidence` : "Track weighting is unavailable for this session."}</p>
                </article>
                <article className="analytics-page__trust-card">
                  <span>Weakest assumption</span>
                  <strong>Approximate segments</strong>
                  <p>{comparison.overview.weakestAssumption}</p>
                </article>
                <article className="analytics-page__trust-card analytics-page__trust-card--proxy">
                  <span>Energy deployment proxy</span>
                  <strong>Proxy only</strong>
                  <p>{comparison.proxyNote}</p>
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
                    <h2>Select an approximate segment.</h2>
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
                            <span>{segment.kind} | {formatPercent(segment.confidence)}</span>
                          </a>
                        ))}
                      </div>
                      {selectedSegment ? (
                        <div className="analytics-page__selected-segment">
                          <article className="analytics-page__selected-segment-card">
                            <span>Selected segment</span>
                            <strong>{selectedSegment.label}</strong>
                            <p>{selectedSegment.kind} | {formatPercent(selectedSegment.confidence)} segment confidence. Segment IDs are approximate product-view identifiers.</p>
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
                      <p>This mode has no capped segment rows for the selected driver pair.</p>
                    </div>
                  )}
                </section>
              ) : null}

              {activeTab === "segments" ? (
                <section className="analytics-page__detail-panel">
                  <div className="analytics-page__section-header">
                    <span>Segment speed delta</span>
                    <h2>Largest approximate segment speed deltas.</h2>
                  </div>
                  <ChartRows rows={chartRows} driverA={comparison.overview.driverA} driverB={comparison.overview.driverB} selectedSegmentId={selectedSegment?.segmentId ?? null} />
                </section>
              ) : null}

              {activeTab === "braking" ? (
                <section className="analytics-page__detail-panel">
                  <div className="analytics-page__section-header">
                    <span>Braking delta</span>
                    <h2>Late-brake and brake-intensity signals.</h2>
                  </div>
                  <ChartRows rows={chartRows} driverA={comparison.overview.driverA} driverB={comparison.overview.driverB} selectedSegmentId={selectedSegment?.segmentId ?? null} />
                </section>
              ) : null}

              {activeTab === "throttle" ? (
                <section className="analytics-page__detail-panel">
                  <div className="analytics-page__section-header">
                    <span>Throttle and traction</span>
                    <h2>Exit traction from approximate segments.</h2>
                  </div>
                  <ChartRows rows={chartRows} driverA={comparison.overview.driverA} driverB={comparison.overview.driverB} selectedSegmentId={selectedSegment?.segmentId ?? null} />
                </section>
              ) : null}

              {activeTab === "straights" ? (
                <section className="analytics-page__detail-panel">
                  <div className="analytics-page__section-header">
                    <span>Straight-line delta</span>
                    <h2>Terminal speed and acceleration signals.</h2>
                  </div>
                  <ChartRows rows={chartRows} driverA={comparison.overview.driverA} driverB={comparison.overview.driverB} selectedSegmentId={selectedSegment?.segmentId ?? null} />
                </section>
              ) : null}

              {activeTab === "energy-proxy" ? (
                <section className="analytics-page__detail-panel analytics-page__detail-panel--proxy">
                  <div className="analytics-page__section-header">
                    <span>Energy deployment proxy</span>
                    <h2>Proxy signal from speed, throttle, RPM, gear, and DRS features.</h2>
                  </div>
                  <ChartRows rows={chartRows} driverA={comparison.overview.driverA} driverB={comparison.overview.driverB} selectedSegmentId={selectedSegment?.segmentId ?? null} />
                  <p className="analytics-page__proxy-note">{comparison.proxyNote}</p>
                </section>
              ) : null}
            </section>
          ) : (
            <StatePanel
              eyebrow="Analytics"
              title="No comparison is available for this selection."
              message="Choose two different drivers from a validated session. The page only reads precomputed Analytics product views."
              tone="notice"
            />
          )}
        </>
      ) : (
        <StatePanel
          eyebrow="Analytics"
          title="Analytics product views are unavailable."
          message="The session index could not be loaded from data/analytics. Rebuild or restore the Analytics product views before using this page."
          tone="error"
          actionHref="/"
          actionLabel="Back to homepage"
        />
      )}

      <SiteFooter />
    </main>
  );
}
