import { useCallback, useEffect, type CSSProperties } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeftRight, ChevronDown } from "lucide-react";
import { z } from "zod";
import { DriverComparisonBroadcast } from "@/components/driver-comparison-broadcast";
import { SiteShell } from "@/components/site-shell";
import { SkeletonPanel } from "@/components/skeleton-block";
import { duelColors, team } from "@/data/teams";
import { getHeadToHead, getTelemetryComparison, getWeekendIndex } from "@/lib/f1.functions";
import { pageSeo } from "@/lib/seo";
import { COMPARISON_VIEW_META, COMPARISON_VIEWS, TELEMETRY_SESSIONS, type ComparisonView, type TelemetrySessionCode } from "@/lib/telemetry-comparison";
import "./vs.css";

const searchSchema = z.object({
  slug: z.string().optional(),
  a: z.string().optional(),
  b: z.string().optional(),
  session: z.enum(TELEMETRY_SESSIONS).optional(),
  view: z.enum(COMPARISON_VIEWS).optional(),
  segment: z.string().optional(),
  lap: z.coerce.number().int().positive().optional(),
  point: z.coerce.number().int().min(0).max(95).optional(),
  range: z.string().regex(/^\d{1,3}-\d{1,3}$/).optional(),
  panel: z.enum(["overview", "telemetry", "segments", "race"]).optional(),
  channel: z.enum(["speed", "inputs", "gear", "rpm", "drs", "energy"]).optional(),
});

const indexQuery = queryOptions({ queryKey: ["weekend-index"], queryFn: () => getWeekendIndex({ data: {} }), staleTime: 5 * 60_000 });

export const Route = createFileRoute("/vs")({
  validateSearch: searchSchema,
  loader: ({ context }) => context.queryClient.ensureQueryData(indexQuery),
  head: () => pageSeo({
    title: "F1 Driver Comparison: Telemetry and Race Dominance | F1 InsightX",
    description: "Compare Formula 1 drivers through gear choice, straight-line speed, corner phases, pit stops and lap-by-lap dominance.",
    path: "/vs",
  }),
  errorComponent: ({ error }) => <SiteShell fullWidth><p role="alert" className="text-sm text-destructive">Driver comparison unavailable: {error instanceof Error ? error.message : String(error)}</p></SiteShell>,
  component: Vs,
});

function legacyView(panel: string | undefined, channel: string | undefined): ComparisonView {
  if (panel === "segments") return "corners";
  if (panel === "race") return "dominance";
  if (panel === "telemetry" && channel === "gear") return "gear";
  if (panel === "telemetry" && channel === "speed") return "straight";
  return "dominance";
}

function portrait(code: string) {
  const asset = code.toUpperCase() === "MAX" ? "ver" : code.toLowerCase();
  return `/assets/drivers/2026/headshots/${asset}.png`;
}

function parseRange(value: string | undefined): [number, number] {
  const [startRaw, endRaw] = (value ?? "0-100").split("-");
  const start = Math.max(0, Math.min(95, Number(startRaw) || 0)) / 100;
  const end = Math.max(5, Math.min(100, Number(endRaw) || 100)) / 100;
  return end - start >= 0.05 ? [start, end] : [0, 1];
}

type SearchPatch = {
  slug?: string | undefined; a?: string | undefined; b?: string | undefined;
  session?: TelemetrySessionCode | undefined; view?: ComparisonView | undefined;
  segment?: string | undefined; lap?: number | undefined; point?: number | undefined;
  range?: string | undefined; panel?: undefined; channel?: undefined;
};

function Vs() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/vs" });
  const { data: index } = useSuspenseQuery(indexQuery);
  const weekends = index.weekends.filter((weekend) => weekend.hasRace).sort((a, b) => b.round - a.round);
  const slug = search.slug ?? weekends[0]?.slug ?? "";
  const selectedWeekend = weekends.find((weekend) => weekend.slug === slug || weekend.raceId === slug) ?? weekends[0] ?? null;

  const initial = useQuery({
    queryKey: ["h2h", slug, search.a ?? "", search.b ?? ""],
    queryFn: () => getHeadToHead({ data: { slug, a: search.a ?? "AUTO", b: search.b ?? "AUTO" } }),
    enabled: Boolean(slug), staleTime: 5 * 60_000,
  });
  const entrants = initial.data?.entrants ?? [];
  const codeA = search.a ?? entrants[0]?.code ?? initial.data?.codes[0] ?? "";
  const codeB = search.b ?? entrants.find((entrant) => entrant.code !== codeA)?.code ?? initial.data?.codes.find((code) => code !== codeA) ?? "";
  const h2h = useQuery({
    queryKey: ["h2h-pair", slug, codeA, codeB],
    queryFn: () => getHeadToHead({ data: { slug, a: codeA, b: codeB } }),
    enabled: Boolean(slug && codeA && codeB), staleTime: 5 * 60_000, placeholderData: (previous) => previous,
  });

  const activeView = search.view ?? legacyView(search.panel, search.channel);
  const raceOnly = activeView === "pits" || activeView === "dominance";
  const requestedSession: TelemetrySessionCode = raceOnly ? "R" : (search.session ?? "R");
  const telemetry = useQuery({
    queryKey: ["telemetry-comparison", slug, codeA, codeB, requestedSession],
    queryFn: () => getTelemetryComparison({ data: { slug, a: codeA, b: codeB, session: requestedSession } }),
    enabled: Boolean(slug && codeA && codeB), staleTime: 5 * 60_000, placeholderData: (previous) => previous,
  });

  const setSearch = useCallback((patch: SearchPatch, replace = false) =>
    navigate({ replace, search: (previous) => ({ ...previous, ...patch }) }), [navigate]);

  useEffect(() => {
    if (raceOnly && search.session !== "R") setSearch({ session: "R" }, true);
  }, [raceOnly, search.session, setSearch]);

  useEffect(() => {
    if (!search.view && (search.panel || search.channel)) setSearch({ view: activeView, panel: undefined, channel: undefined }, true);
  }, [activeView, search.channel, search.panel, search.view, setSearch]);

  const data = h2h.data;
  const entrantA = entrants.find((entrant) => entrant.code === codeA);
  const entrantB = entrants.find((entrant) => entrant.code === codeB);
  const teamAName = data?.race[0]?.team ?? entrantA?.team ?? null;
  const teamBName = data?.race[1]?.team ?? entrantB?.team ?? null;
  const identityA = team(teamAName);
  const identityB = team(teamBName);
  const colors = duelColors(teamAName, teamBName);
  const theme = { "--vs-a": colors.colorA, "--vs-b": colors.colorB } as CSSProperties;
  const telemetrySessions = telemetry.data?.availableSessions ?? [];
  const range = parseRange(search.range);
  const pending = initial.isPending || h2h.isPending;

  const selectView = (view: ComparisonView) => {
    const nextRaceOnly = view === "pits" || view === "dominance";
    setSearch({ view, session: nextRaceOnly ? "R" : requestedSession, segment: undefined, lap: undefined, point: undefined, range: undefined, panel: undefined, channel: undefined });
  };
  const selectSession = (session: TelemetrySessionCode) => {
    setSearch({ session, view: raceOnly && session !== "R" ? "gear" : activeView, segment: undefined, lap: undefined, point: undefined, range: undefined, panel: undefined, channel: undefined });
  };

  return (
    <SiteShell fullWidth>
      <main className="vs-broadcast" style={theme}>
        <header className="vs-matchup">
          <div className="vs-matchup-meta"><span>Driver comparison · R{selectedWeekend?.round ?? "—"}</span><strong>{data?.name ?? selectedWeekend?.name ?? "Race weekend"}</strong><small>{data?.circuit ?? selectedWeekend?.circuit ?? "Circuit unavailable"}</small></div>
          <div className="vs-matchup-driver vs-matchup-driver-a">{codeA ? <img src={portrait(codeA)} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : null}<div><span style={{ color: colors.colorA }}>{codeA}</span><strong>{entrantA?.name ?? codeA}</strong><small>{identityA.name}</small></div></div>
          <button className="vs-swap" type="button" onClick={() => setSearch({ a: codeB, b: codeA, point: undefined, segment: undefined, lap: undefined })} aria-label="Swap drivers"><ArrowLeftRight size={18} /><span>Swap</span></button>
          <div className="vs-matchup-driver vs-matchup-driver-b">{codeB ? <img src={portrait(codeB)} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : null}<div><span style={{ color: colors.colorB }}>{codeB}</span><strong>{entrantB?.name ?? codeB}</strong><small>{identityB.name}</small></div></div>
        </header>

        <div className="vs-selector-row" role="group" aria-label="Comparison selection">
          <label><span>Weekend</span><div><select value={selectedWeekend?.slug ?? ""} onChange={(event) => setSearch({ slug: event.target.value, a: undefined, b: undefined, point: undefined, segment: undefined, lap: undefined })}>{weekends.map((weekend) => <option key={weekend.slug} value={weekend.slug ?? ""}>R{weekend.round} · {weekend.name}{weekend.resultsOnly ? " · results" : ""}</option>)}</select><ChevronDown size={14} /></div></label>
          {[{ key: "a" as const, label: "Driver 01", value: codeA, other: codeB }, { key: "b" as const, label: "Driver 02", value: codeB, other: codeA }].map((selector) => <label key={selector.key}><span>{selector.label}</span><div><select value={selector.value} onChange={(event) => setSearch({ [selector.key]: event.target.value, ...(selector.key === "a" ? { b: codeB } : { a: codeA }), point: undefined, segment: undefined, lap: undefined })}>{entrants.filter((entrant) => entrant.code !== selector.other || entrant.code === selector.value).map((entrant) => <option key={entrant.code} value={entrant.code}>{entrant.code} · {entrant.name} · {team(entrant.team).short}</option>)}</select><ChevronDown size={14} /></div></label>)}
        </div>

        <div className="vs-analysis-nav sticky top-0 z-20">
          <div className="vs-session-rail" role="group" aria-label="Telemetry session"><span>Session</span>{TELEMETRY_SESSIONS.map((session) => { const available = telemetrySessions.includes(session); return <button key={session} type="button" disabled={telemetry.data ? !available : false} aria-pressed={requestedSession === session} title={available ? session : `${session} unavailable`} onClick={() => selectSession(session)}>{session}</button>; })}</div>
          <nav className="vs-view-rail" aria-label="Driver comparison views">{COMPARISON_VIEW_META.map((item, index) => <button key={item.id} type="button" aria-current={activeView === item.id ? "page" : undefined} onClick={() => selectView(item.id)}><i>{String(index + 1).padStart(2, "0")}</i><span>{item.label}</span>{item.raceOnly ? <small>Race</small> : null}</button>)}</nav>
        </div>

        {raceOnly ? <div className="vs-race-mode"><span>Race evidence</span><strong>{activeView === "pits" ? "Pit Stops" : "Dominance"} automatically uses the Race session.</strong></div> : null}

        {pending ? <div className="vs-loading"><SkeletonPanel rows={6} label="Loading driver comparison" /></div>
          : !data ? <div className="bc-empty"><span>Data status</span><h2>No stored comparison</h2><p>Select another race weekend or driver pairing.</p></div>
          : telemetry.isError && activeView !== "pits" ? <div className="bc-empty" role="alert"><span>Telemetry status</span><h2>Prepared telemetry unavailable</h2><p>{telemetry.error instanceof Error ? telemetry.error.message : "The telemetry comparison could not be loaded."}</p></div>
          : telemetry.isPending && !telemetry.data && activeView !== "pits" ? <div className="vs-loading"><SkeletonPanel rows={6} label="Loading telemetry evidence" /></div>
          : <DriverComparisonBroadcast view={activeView} telemetry={telemetry.data ?? null} h2h={data} codeA={codeA} codeB={codeB} colorA={colors.colorA} colorB={colors.colorB} segment={search.segment ?? null} lap={search.lap ?? null} point={search.point ?? null} range={range} onSegmentChange={(segment) => setSearch({ segment: segment ?? undefined })} onLapChange={(lap) => setSearch({ lap: lap ?? undefined })} onPointChange={(point) => setSearch({ point: point ?? undefined })} onRangeChange={(next) => setSearch({ range: next[0] === 0 && next[1] === 1 ? undefined : `${Math.round(next[0] * 100)}-${Math.round(next[1] * 100)}`, point: undefined })} />}
      </main>
    </SiteShell>
  );
}
