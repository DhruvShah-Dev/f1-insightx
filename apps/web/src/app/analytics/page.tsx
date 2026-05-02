import { HomeLink } from "@/components/ui/home-link";
import { ProductRuntimeNote } from "@/components/ui/product-runtime-note";
import { SiteFooter } from "@/components/ui/site-footer";
import { StatePanel } from "@/components/ui/state-panel";
import { withServerFallback } from "@/lib/errors/logger";
import {
  getAnalyticsComparisonResult,
  getAnalyticsDrivers,
  listAnalyticsSessionsResult,
  type AnalyticsComparisonPayload,
  type AnalyticsSessionSummary,
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

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return "n/a";
  return `${Math.round(value * 100)}%`;
}

function formatSigned(value: number | null | undefined, unit = "") {
  if (value === null || value === undefined || !Number.isFinite(value)) return "Even";
  if (Math.abs(value) < 0.0001) return "Even";
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

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const params = (await searchParams) ?? {};
  const sessionIdParam = firstParam(params.sessionId);
  const driverAParam = firstParam(params.driverA);
  const driverBParam = firstParam(params.driverB);

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
      () => getAnalyticsComparisonResult(selectedSession.id, selectedDriverA, selectedDriverB),
      { mode: "unavailable" as const, data: null, meta: { ...unavailableRuntime, eventId: selectedSession.id } },
      "page:analytics:comparison",
      { sessionId: selectedSession.id, driverA: selectedDriverA, driverB: selectedDriverB },
    )
    : null;
  const comparison = comparisonResult?.mode === "unavailable" ? null : comparisonResult?.data ?? null;
  const metricCards = comparison ? buildMetricCards(comparison) : [];

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
            <ProductRuntimeNote runtime={sessionResult.meta} className="analytics-page__runtime" primaryLabel="Analytics product views" />
          </div>
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
