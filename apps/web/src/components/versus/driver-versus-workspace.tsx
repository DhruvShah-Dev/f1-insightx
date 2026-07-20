"use client";

import type { CSSProperties } from "react";
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
import { getCurrentDriverMetaByCode } from "@/lib/ui/driver-asset-manifest";
import { getTeamAsset } from "@/lib/ui/asset-manifest";

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

type Palette = {
  a: string;
  b: string;
  neutral: string;
  sameTeam: boolean;
};

type EvidenceTab = "race-pace" | "trace" | "corners" | "straights" | "braking-traction";

const tabs: Array<{ id: EvidenceTab; label: string }> = [
  { id: "race-pace", label: "Race pace" },
  { id: "trace", label: "Trace" },
  { id: "corners", label: "Corners" },
  { id: "straights", label: "Straights" },
  { id: "braking-traction", label: "Brake + traction" },
];

const darkPanel = "#080b10";
const neutral = "#d7dde8";

function formatNumber(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "n/a";
  if (Math.abs(value) < 0.005) return "0";
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function teamPalette(driverA: AnalyticsDriverOption, driverB: AnalyticsDriverOption): Palette {
  const metaA = getCurrentDriverMetaByCode(driverA.code);
  const metaB = getCurrentDriverMetaByCode(driverB.code);
  const teamA = getTeamAsset(driverA.team ?? metaA.teamId);
  const teamB = getTeamAsset(driverB.team ?? metaB.teamId);
  const sameTeam = teamA.id === teamB.id || (driverA.team && driverA.team === driverB.team);
  const a = teamA.primary && teamA.primary.toLowerCase() !== "#ffffff" ? teamA.primary : teamA.accent || "#e10600";
  const bBase = sameTeam ? teamB.secondary || teamB.accent || "#f4f6f8" : teamB.primary || teamB.accent || "#f5c542";
  const b = bBase.toLowerCase() === a.toLowerCase() ? teamB.accent || "#f5c542" : bBase;
  return { a, b, neutral, sameTeam: Boolean(sameTeam) };
}

function driverLabel(driver: AnalyticsDriverOption) {
  return driver.team ? `${driver.code} / ${driver.team}` : driver.code;
}

function fallbackDriver(drivers: AnalyticsDriverOption[], code: string, index: number): AnalyticsDriverOption {
  return drivers.find((driver) => driver.code === code) ?? drivers[index] ?? { code: code || "DRV", team: null };
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
  const [activeTab, setActiveTab] = useState<EvidenceTab>("race-pace");
  const [error, setError] = useState<string | null>(initialComparison ? null : "No comparison is available for this driver pair.");
  const [isPending, startTransition] = useTransition();

  const currentSession = sessions.find((session) => session.id === sessionId) ?? comparison?.session ?? null;
  const validDriverB = driverB && driverB !== driverA ? driverB : drivers.find((driver) => driver.code !== driverA)?.code ?? "";
  const visualA = comparison?.drivers.a ?? fallbackDriver(drivers, driverA, 0);
  const visualB = comparison?.drivers.b ?? fallbackDriver(drivers, validDriverB, 1);
  const palette = teamPalette(visualA, visualB);

  const lapRows = useMemo(() => {
    if (!comparison?.lapPace.available) return [];
    const byLap = new Map<number, Record<string, string | number | null>>();
    for (const point of [...comparison.lapPace.driverA, ...comparison.lapPace.driverB]) {
      const row = byLap.get(point.lapNumber) ?? { lap: point.lapNumber, phase: point.racePhase, compound: point.compound };
      row[point.driver] = point.normalizedPaceDeltaS ?? point.lapTimeS;
      row[`${point.driver} position`] = point.position;
      byLap.set(point.lapNumber, row);
    }
    return [...byLap.values()].sort((left, right) => Number(left.lap) - Number(right.lap));
  }, [comparison]);

  const traceRows = useMemo(() => {
    const traceA = comparison?.telemetryTraces.driverA;
    const traceB = comparison?.telemetryTraces.driverB;
    if (!traceA || !traceB) return [];
    const limit = Math.min(traceA.points.length, traceB.points.length);
    const step = Math.max(1, Math.floor(limit / 180));
    const rows: Array<Record<string, number | null>> = [];
    for (let index = 0; index < limit; index += step) {
      rows.push({
        x: Math.round(traceA.points[index].x),
        speedA: traceA.points[index].speed,
        speedB: traceB.points[index].speed,
        throttleA: traceA.points[index].throttle,
        throttleB: traceB.points[index].throttle,
        brakeA: traceA.points[index].brake,
        brakeB: traceB.points[index].brake,
      });
    }
    return rows;
  }, [comparison]);

  const cornerRows = useMemo(() => comparison?.segmentHighlights.map((row) => ({
    segment: row.segmentId,
    entry: row.entrySpeedDeltaKph,
    apex: row.apexSpeedDeltaKph,
    exit: row.exitSpeedDeltaKph,
  })) ?? [], [comparison]);

  const straightRows = useMemo(() => comparison?.straightHighlights.map((row) => ({
    segment: row.segmentId,
    terminal: row.terminalSpeedDeltaKph,
    accel: row.accelerationDelta === null ? null : row.accelerationDelta * 100,
    drs: row.drsActiveDeltaPct,
  })) ?? [], [comparison]);

  const energyRows = useMemo(() => comparison?.energyProxyHighlights.map((row) => ({
    segment: row.segmentId,
    deploy: row.deploymentProxyDelta,
    coast: row.liftAndCoastDelta,
    clip: row.clippingProxyDelta,
  })) ?? [], [comparison]);

  const brakingRows = useMemo(() => comparison?.brakingHighlights.map((row) => ({
    segment: row.segmentId,
    late: row.lateBrakeDelta === null ? null : row.lateBrakeDelta * 100,
    distance: row.brakingDistanceDeltaM,
    intensity: row.brakeIntensityDelta === null ? null : row.brakeIntensityDelta * 100,
  })) ?? [], [comparison]);

  const tractionRows = useMemo(() => comparison?.throttleHighlights.map((row) => ({
    segment: row.segmentId,
    pickup: row.throttlePickupDeltaM,
    full: row.fullThrottleExitDeltaM,
    traction: row.tractionExitDelta === null ? null : row.tractionExitDelta * 100,
  })) ?? [], [comparison]);

  const coverageLabel = comparison?.lapPace.available
    ? `Race pace available: ${comparison.lapPace.pointCount} plotted laps`
    : comparison?.session.session === "R"
      ? "Race pace missing for this pair"
      : "Representative telemetry only";

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

  function changeDriverA(nextDriverA: string) {
    setDriverA(nextDriverA);
    if (nextDriverA === driverB) {
      setDriverB(drivers.find((driver) => driver.code !== nextDriverA)?.code ?? "");
    }
  }

  return (
    <div
      className="versus-shell"
      style={{
        "--driver-a": palette.a,
        "--driver-b": palette.b,
      } as CSSProperties}
    >
      <aside className="versus-command-rail" aria-label="Session command rail">
        <div className="versus-command-rail__brand">
          <span>Driver vs Driver</span>
          <strong>Pit-wall telemetry</strong>
        </div>

        <label>
          Season / event / session
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
          <select value={driverA} onChange={(event) => changeDriverA(event.target.value)}>
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
          {isPending ? "Loading..." : "Run compare"}
        </button>

        <div className="versus-coverage">
          <span>Coverage</span>
          <strong>{coverageLabel}</strong>
          <small>Analytics coverage reaches 2026 Barcelona locally; race analysis extends further, but unavailable races are not selectable here.</small>
        </div>
        <div className="versus-coverage">
          <span>What this can prove</span>
          <strong>{currentSession?.session === "R" ? "Race pace + telemetry signals" : "Representative lap + segment deltas"}</strong>
          <small>Approximate segment and energy deployment proxy wording is preserved by design.</small>
        </div>
      </aside>

      <main className="versus-pitwall">
        {comparison ? (
          <>
            <section className="versus-duel-summary">
              <div>
                <span>{comparison.session.season} R{comparison.session.round} / {comparison.session.event} / {comparison.session.session}</span>
                <h1>{comparison.overview.driverA} vs {comparison.overview.driverB}</h1>
                <p>{comparison.primaryInsight}</p>
                {palette.sameTeam ? <small>Same-team comparison uses constructor color plus secondary/accent stroke and dashed trace encoding.</small> : null}
              </div>
              <div className="versus-driver-ledger" aria-label="Driver ledger">
                <DriverLedger code={comparison.overview.driverA} team={comparison.drivers.a.team} color={palette.a} />
                <DriverLedger code={comparison.overview.driverB} team={comparison.drivers.b.team} color={palette.b} dashed={palette.sameTeam} />
              </div>
            </section>

            <section className="versus-signal-strip" aria-label="Evidence summary">
              <Signal label="Confidence" value={`${Math.round((comparison.overview.confidence ?? 0) * 100)}%`} detail={comparison.dataStrengthLabel} />
              <Signal label="Corner delta" value={`${formatNumber(comparison.overview.avgSegmentDeltaKph)} kph`} detail="Average approximate segment apex signal" />
              <Signal label="Straight delta" value={`${formatNumber(comparison.overview.avgStraightDeltaKph)} kph`} detail="Terminal speed signal" />
              <Signal label="Energy" value={formatNumber(comparison.overview.energyDeploymentProxyDelta)} detail="Energy deployment proxy" />
            </section>

            <section className="versus-evidence-console">
              <div className="versus-evidence-console__tabs" role="tablist" aria-label="Telemetry evidence">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    className={activeTab === tab.id ? "is-active" : ""}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              {activeTab === "race-pace" ? (
                comparison.lapPace.available ? (
                  <ChartFrame
                    title="Lap-by-lap normalized race pace"
                    subtitle={`${comparison.lapPace.qualityNote} Null lap times excluded: ${comparison.lapPace.nullLapTimeCount}.`}
                    dark
                  >
                    <LineChart data={lapRows} margin={{ left: -8, right: 18, top: 12 }}>
                      <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                      <XAxis dataKey="lap" tickLine={false} axisLine={false} stroke="var(--chart-axis)" />
                      <YAxis tickLine={false} axisLine={false} stroke="var(--chart-axis)" />
                      <ReferenceLine y={0} stroke="rgba(244,246,248,0.45)" />
                      <Tooltip contentStyle={{ background: darkPanel, border: "1px solid var(--versus-line)", color: "#f4f6f8" }} />
                      <Line type="monotone" dataKey={comparison.overview.driverA} stroke={palette.a} strokeWidth={2.5} dot={false} name={`${comparison.overview.driverA} pace delta`} />
                      <Line type="monotone" dataKey={comparison.overview.driverB} stroke={palette.b} strokeWidth={2.5} dot={false} strokeDasharray={palette.sameTeam ? "7 5" : undefined} name={`${comparison.overview.driverB} pace delta`} />
                    </LineChart>
                  </ChartFrame>
                ) : (
                  <UnavailablePanel title="Lap-by-lap race pace unavailable" message={comparison.lapPace.reason ?? "Race lap pace is unavailable for this pair."} />
                )
              ) : activeTab === "trace" ? (
                <ChartFrame title="Representative speed + controls trace" subtitle={comparison.telemetryTraces.note} dark>
                  <LineChart data={traceRows} margin={{ left: -8, right: 18, top: 12 }}>
                    <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                    <XAxis dataKey="x" tickLine={false} axisLine={false} stroke="var(--chart-axis)" />
                    <YAxis yAxisId="speed" tickLine={false} axisLine={false} stroke="var(--chart-axis)" />
                    <YAxis yAxisId="control" orientation="right" domain={[0, 100]} hide />
                    <Tooltip contentStyle={{ background: darkPanel, border: "1px solid var(--versus-line)", color: "#f4f6f8" }} />
                    <Line yAxisId="speed" type="monotone" dataKey="speedA" stroke={palette.a} strokeWidth={2.5} dot={false} name={`${comparison.overview.driverA} speed`} />
                    <Line yAxisId="speed" type="monotone" dataKey="speedB" stroke={palette.b} strokeWidth={2.5} dot={false} strokeDasharray={palette.sameTeam ? "7 5" : undefined} name={`${comparison.overview.driverB} speed`} />
                    <Line yAxisId="control" type="monotone" dataKey="throttleA" stroke={palette.a} strokeWidth={1.2} dot={false} opacity={0.45} name={`${comparison.overview.driverA} throttle`} />
                    <Line yAxisId="control" type="monotone" dataKey="brakeB" stroke={palette.b} strokeWidth={1.2} dot={false} opacity={0.45} strokeDasharray="3 4" name={`${comparison.overview.driverB} brake`} />
                  </LineChart>
                </ChartFrame>
              ) : activeTab === "corners" ? (
                <DeltaBars title="Corner speed analysis" subtitle="Entry, apex, and exit deltas across approximate segments." rows={cornerRows} keys={["entry", "apex", "exit"]} palette={palette} />
              ) : activeTab === "straights" ? (
                <div className="versus-split-charts">
                  <DeltaBars title="Straight-line speed" subtitle="Terminal speed, acceleration, and DRS active delta." rows={straightRows} keys={["terminal", "accel", "drs"]} palette={palette} />
                  <DeltaBars title="Energy deployment proxy" subtitle={comparison.proxyNote} rows={energyRows} keys={["deploy", "coast", "clip"]} palette={palette} />
                </div>
              ) : (
                <div className="versus-split-charts">
                  <DeltaBars title="Braking story" subtitle="Late-brake score, braking distance, and brake-intensity proxy. Braking start distance is caveated where missing." rows={brakingRows} keys={["late", "distance", "intensity"]} palette={palette} />
                  <DeltaBars title="Traction story" subtitle="Throttle pickup, full-throttle exit, and traction proxy. Full-throttle exit can be low-confidence when absent." rows={tractionRows} keys={["pickup", "full", "traction"]} palette={palette} />
                </div>
              )}
            </section>

            <section className="versus-quality-note">
              <strong>Data quality</strong>
              <p>{comparison.overview.weakestAssumption} Braking start distance has known missingness, full-throttle exit can be absent, and race traffic/dirty-air is proxy evidence rather than exact gap truth.</p>
            </section>
          </>
        ) : (
          <UnavailablePanel title="Comparison unavailable" message={error ?? "Select another session or driver pair."} />
        )}
      </main>
    </div>
  );
}

function DriverLedger({ code, team, color, dashed = false }: { code: string; team: string | null; color: string; dashed?: boolean }) {
  return (
    <article className="versus-driver-ledger__item" style={{ "--driver-color": color } as CSSProperties}>
      <span style={{ borderStyle: dashed ? "dashed" : "solid" }} />
      <strong>{code}</strong>
      <small>{team ?? "Unknown team"}</small>
    </article>
  );
}

function Signal({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function UnavailablePanel({ title, message }: { title: string; message: string }) {
  return (
    <section className="versus-unavailable">
      <strong>{title}</strong>
      <p>{message}</p>
    </section>
  );
}

function DeltaBars({
  title,
  subtitle,
  rows,
  keys,
  palette,
}: {
  title: string;
  subtitle: string;
  rows: Array<Record<string, string | number | null>>;
  keys: string[];
  palette: Palette;
}) {
  if (!rows.length) {
    return <UnavailablePanel title={title} message="No indexed rows are available for this selected evidence view." />;
  }

  return (
    <ChartFrame title={title} subtitle={subtitle} dark>
      <BarChart data={rows} margin={{ left: -8, right: 12, top: 12 }}>
        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
        <XAxis dataKey="segment" tickLine={false} axisLine={false} stroke="var(--chart-axis)" />
        <YAxis tickLine={false} axisLine={false} stroke="var(--chart-axis)" />
        <ReferenceLine y={0} stroke="rgba(244,246,248,0.38)" />
        <Tooltip formatter={(value) => formatNumber(Number(value))} contentStyle={{ background: darkPanel, border: "1px solid var(--versus-line)", color: "#f4f6f8" }} />
        {keys.map((key, index) => (
          <Bar key={key} dataKey={key} radius={[2, 2, 0, 0]}>
            {rows.map((row) => (
              <Cell key={`${key}-${row.segment}`} fill={Number(row[key] ?? 0) >= 0 ? (index === 2 ? palette.neutral : palette.a) : palette.b} />
            ))}
          </Bar>
        ))}
      </BarChart>
    </ChartFrame>
  );
}
