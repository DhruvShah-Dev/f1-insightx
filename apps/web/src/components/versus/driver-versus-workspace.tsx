"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartFrame } from "@/components/charts/chart-frame";
import type {
  AnalyticsComparisonPayload,
  AnalyticsDriverOption,
  AnalyticsSessionSummary,
} from "@/lib/server/analytics-product";

type Props = {
  sessions: AnalyticsSessionSummary[];
  initialDrivers: AnalyticsDriverOption[];
  initialComparison: AnalyticsComparisonPayload | null;
};

type ApiResult<T> = {
  ok: boolean;
  data?: T;
  error?: { message?: string };
};

const metricColor = "#ff5a36";
const comparisonColor = "#f4c95d";

function formatMetric(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "n/a";
  if (Math.abs(value) < 0.005) return "0";
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function driverLabel(driver: AnalyticsDriverOption) {
  return driver.team ? `${driver.code} / ${driver.team}` : driver.code;
}

async function loadJson<T>(url: string) {
  const response = await fetch(url);
  const payload = await response.json() as ApiResult<T>;
  if (!response.ok || !payload.ok || !payload.data) {
    throw new Error(payload.error?.message ?? "Request failed.");
  }
  return payload.data;
}

export function DriverVersusWorkspace({ sessions, initialDrivers, initialComparison }: Props) {
  const [sessionId, setSessionId] = useState(initialComparison?.session.id ?? sessions[0]?.id ?? "");
  const [drivers, setDrivers] = useState(initialDrivers);
  const [driverA, setDriverA] = useState(initialComparison?.drivers.a.code ?? initialDrivers[0]?.code ?? "");
  const [driverB, setDriverB] = useState(initialComparison?.drivers.b.code ?? initialDrivers.find((driver) => driver.code !== driverA)?.code ?? "");
  const [comparison, setComparison] = useState(initialComparison);
  const [error, setError] = useState<string | null>(initialComparison ? null : "No comparison is available for the selected drivers.");
  const [isPending, startTransition] = useTransition();

  const currentSession = sessions.find((session) => session.id === sessionId) ?? comparison?.session ?? sessions[0] ?? null;
  const validDriverB = driverB && driverB !== driverA ? driverB : drivers.find((driver) => driver.code !== driverA)?.code ?? "";

  const scoreRows = useMemo(() => {
    if (!comparison) return [];
    const overview = comparison.overview;
    return [
      { metric: "Corner segments", [overview.driverA]: overview.segmentAdvantageCountA, [overview.driverB]: overview.segmentAdvantageCountB },
      { metric: "Straights", [overview.driverA]: overview.straightAdvantageCountA, [overview.driverB]: overview.straightAdvantageCountB },
    ];
  }, [comparison]);

  const deltaRows = useMemo(() => {
    if (!comparison) return [];
    return [
      { metric: "Avg corner kph", value: comparison.overview.avgSegmentDeltaKph },
      { metric: "Avg straight kph", value: comparison.overview.avgStraightDeltaKph },
      { metric: "Braking score", value: comparison.overview.brakingAdvantageScore === null ? null : comparison.overview.brakingAdvantageScore * 100 },
      { metric: "Traction score", value: comparison.overview.tractionAdvantageScore === null ? null : comparison.overview.tractionAdvantageScore * 100 },
      { metric: "Energy proxy", value: comparison.overview.energyDeploymentProxyDelta },
    ];
  }, [comparison]);

  const segmentRows = useMemo(() => comparison?.segmentHighlights.map((row) => ({
    segment: row.segmentId,
    entry: row.entrySpeedDeltaKph,
    apex: row.apexSpeedDeltaKph,
    exit: row.exitSpeedDeltaKph,
  })) ?? [], [comparison]);

  const brakingRows = useMemo(() => comparison?.brakingHighlights.map((row) => ({
    segment: row.segmentId,
    late: row.lateBrakeDelta,
    distance: row.brakingDistanceDeltaM,
    intensity: row.brakeIntensityDelta,
  })) ?? [], [comparison]);

  const straightRows = useMemo(() => comparison?.straightHighlights.map((row) => ({
    segment: row.segmentId,
    terminal: row.terminalSpeedDeltaKph,
    acceleration: row.accelerationDelta,
    drs: row.drsActiveDeltaPct,
  })) ?? [], [comparison]);

  const energyRows = useMemo(() => comparison?.energyProxyHighlights.map((row) => ({
    segment: row.segmentId,
    deployment: row.deploymentProxyDelta,
    lift: row.liftAndCoastDelta,
    clipping: row.clippingProxyDelta,
  })) ?? [], [comparison]);

  const traceRows = useMemo(() => {
    const traceA = comparison?.telemetryTraces.driverA;
    const traceB = comparison?.telemetryTraces.driverB;
    if (!traceA || !traceB) return [];
    const step = Math.max(1, Math.floor(Math.min(traceA.points.length, traceB.points.length) / 180));
    const rows = [];
    for (let index = 0; index < Math.min(traceA.points.length, traceB.points.length); index += step) {
      rows.push({
        x: Math.round(traceA.points[index].x),
        speedA: traceA.points[index].speed,
        speedB: traceB.points[index].speed,
        energyA: traceA.points[index].energyProxy,
        energyB: traceB.points[index].energyProxy,
      });
    }
    return rows;
  }, [comparison]);

  function refresh(nextSessionId = sessionId, nextDriverA = driverA, nextDriverB = validDriverB) {
    if (!nextSessionId || !nextDriverA || !nextDriverB || nextDriverA === nextDriverB) return;
    startTransition(async () => {
      try {
        setError(null);
        const data = await loadJson<{ comparison: AnalyticsComparisonPayload }>(
          `/api/analytics/compare?sessionId=${encodeURIComponent(nextSessionId)}&driverA=${encodeURIComponent(nextDriverA)}&driverB=${encodeURIComponent(nextDriverB)}&mode=all`,
        );
        setComparison(data.comparison);
        setDriverA(data.comparison.drivers.a.code);
        setDriverB(data.comparison.drivers.b.code);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load comparison.");
      }
    });
  }

  function changeSession(nextSessionId: string) {
    setSessionId(nextSessionId);
    startTransition(async () => {
      try {
        setError(null);
        const data = await loadJson<{ drivers: AnalyticsDriverOption[] }>(`/api/analytics/session/${encodeURIComponent(nextSessionId)}/drivers`);
        const nextDrivers = data.drivers;
        const nextA = nextDrivers[0]?.code ?? "";
        const nextB = nextDrivers.find((driver) => driver.code !== nextA)?.code ?? "";
        setDrivers(nextDrivers);
        setDriverA(nextA);
        setDriverB(nextB);
        if (nextA && nextB) refresh(nextSessionId, nextA, nextB);
      } catch (loadError) {
        setComparison(null);
        setError(loadError instanceof Error ? loadError.message : "Unable to load session drivers.");
      }
    });
  }

  return (
    <div className="versus-workspace">
      <section className="versus-hero">
        <div>
          <span>Driver vs Driver</span>
          <h1>Telemetry comparison workspace</h1>
          <p>{comparison?.primaryInsight ?? "Choose a session and two drivers to compare prepared telemetry signals."}</p>
        </div>
        <div className="versus-control-panel">
          <label>
            Session
            <select value={sessionId} onChange={(event) => changeSession(event.target.value)}>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.season} R{session.round} {session.event} {session.session}
                </option>
              ))}
            </select>
          </label>
          <label>
            Driver A
            <select value={driverA} onChange={(event) => setDriverA(event.target.value)}>
              {drivers.map((driver) => <option key={driver.code} value={driver.code}>{driverLabel(driver)}</option>)}
            </select>
          </label>
          <label>
            Driver B
            <select value={validDriverB} onChange={(event) => setDriverB(event.target.value)}>
              {drivers.filter((driver) => driver.code !== driverA).map((driver) => <option key={driver.code} value={driver.code}>{driverLabel(driver)}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => refresh()} disabled={isPending || !driverA || !validDriverB}>
            {isPending ? "Loading..." : "Compare"}
          </button>
        </div>
      </section>

      {comparison && currentSession ? (
        <>
          <section className="versus-kpi-strip">
            <article>
              <span>Data strength</span>
              <strong>{comparison.dataStrengthLabel}</strong>
              <small>{Math.round((comparison.overview.confidence ?? 0) * 100)}% pair confidence</small>
            </article>
            <article>
              <span>Track type</span>
              <strong>{comparison.trackSummary?.trackArchetype ?? currentSession.trackArchetype}</strong>
              <small>{currentSession.segmentCount} segments / {currentSession.straightCount} straights</small>
            </article>
            <article>
              <span>Driver edge</span>
              <strong>{comparison.overview.driverA} vs {comparison.overview.driverB}</strong>
              <small>{comparison.overview.strategyRelevanceNote}</small>
            </article>
          </section>

          <section className="versus-chart-grid">
            <ChartFrame title="Segment wins" subtitle="Count of prepared corner and straight segments led by each driver." dark>
              <BarChart data={scoreRows} margin={{ left: -10, right: 8, top: 12 }}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="metric" tickLine={false} axisLine={false} stroke="var(--chart-axis)" />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} stroke="var(--chart-axis)" />
                <Tooltip contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }} />
                <Bar dataKey={comparison.overview.driverA} fill={metricColor} radius={[3, 3, 0, 0]} />
                <Bar dataKey={comparison.overview.driverB} fill={comparisonColor} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ChartFrame>

            <ChartFrame title="Signed advantage" subtitle={`Positive values favor ${comparison.overview.driverA}; negative values favor ${comparison.overview.driverB}.`}>
              <BarChart data={deltaRows} margin={{ left: -8, right: 18, top: 12 }}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="metric" tickLine={false} axisLine={false} stroke="var(--chart-axis)" />
                <YAxis tickLine={false} axisLine={false} stroke="var(--chart-axis)" />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.4)" />
                <Tooltip formatter={(value) => formatMetric(Number(value))} contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }} />
                <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                  {deltaRows.map((row) => <Cell key={row.metric} fill={(row.value ?? 0) >= 0 ? metricColor : comparisonColor} />)}
                </Bar>
              </BarChart>
            </ChartFrame>
          </section>

          {traceRows.length ? (
            <section className="versus-wide-chart">
              <ChartFrame title="Representative speed trace" subtitle={`${comparison.telemetryTraces.qualityTier}. ${comparison.telemetryTraces.note}`} dark>
                <LineChart data={traceRows} margin={{ left: -8, right: 16, top: 12 }}>
                  <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="x" tickLine={false} axisLine={false} stroke="var(--chart-axis)" />
                  <YAxis tickLine={false} axisLine={false} stroke="var(--chart-axis)" />
                  <Tooltip contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }} />
                  <Line type="monotone" dot={false} strokeWidth={2.4} dataKey="speedA" name={`${comparison.overview.driverA} speed`} stroke={metricColor} />
                  <Line type="monotone" dot={false} strokeWidth={2.4} dataKey="speedB" name={`${comparison.overview.driverB} speed`} stroke={comparisonColor} />
                </LineChart>
              </ChartFrame>
            </section>
          ) : null}

          <section className="versus-chart-grid versus-chart-grid--dense">
            <DeltaBars title="Corner speed deltas" subtitle="Entry, apex, and exit speed deltas by strongest segment." rows={segmentRows} keys={["entry", "apex", "exit"]} />
            <DeltaBars title="Braking deltas" subtitle="Late braking, distance, and intensity proxy by segment." rows={brakingRows} keys={["late", "distance", "intensity"]} />
            <DeltaBars title="Straight-line speed" subtitle="Terminal speed, acceleration, and DRS active delta by straight." rows={straightRows} keys={["terminal", "acceleration", "drs"]} />
            <DeltaBars title="Energy usage proxy" subtitle={comparison.proxyNote} rows={energyRows} keys={["deployment", "lift", "clipping"]} />
          </section>

          <section className="versus-quality-note">
            <strong>Quality note</strong>
            <p>{comparison.overview.weakestAssumption} Energy deployment is proxy evidence, not true ERS or battery state.</p>
          </section>
        </>
      ) : (
        <section className="versus-quality-note">
          <strong>Comparison unavailable</strong>
          <p>{error ?? "Select another driver pair."}</p>
        </section>
      )}
    </div>
  );
}

function DeltaBars({
  title,
  subtitle,
  rows,
  keys,
}: {
  title: string;
  subtitle: string;
  rows: Array<Record<string, string | number | null>>;
  keys: string[];
}) {
  return (
    <ChartFrame title={title} subtitle={subtitle}>
      <BarChart data={rows} margin={{ left: -8, right: 12, top: 12 }}>
        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
        <XAxis dataKey="segment" tickLine={false} axisLine={false} stroke="var(--chart-axis)" />
        <YAxis tickLine={false} axisLine={false} stroke="var(--chart-axis)" />
        <ReferenceLine y={0} stroke="rgba(255,255,255,0.34)" />
        <Tooltip formatter={(value) => formatMetric(Number(value))} contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }} />
        {keys.map((key, index) => (
          <Bar key={key} dataKey={key} fill={index === 0 ? metricColor : index === 1 ? comparisonColor : "rgba(255,255,255,0.5)"} radius={[3, 3, 0, 0]} />
        ))}
      </BarChart>
    </ChartFrame>
  );
}
