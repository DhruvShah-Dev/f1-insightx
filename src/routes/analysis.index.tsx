import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, Calendar, Search, Trophy } from "iconoir-react/regular";
import { SiteShell } from "@/components/site-shell";
import { team } from "@/data/teams";
import { fmtDate } from "@/lib/format";
import { getWeekendIndex } from "@/lib/f1.functions";
import "@/analysis.css";

const indexQuery = queryOptions({
  queryKey: ["weekend-index"],
  queryFn: () => getWeekendIndex({ data: {} }),
  staleTime: 5 * 60_000,
});

export const Route = createFileRoute("/analysis/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(indexQuery),
  head: () => ({ meta: [
    { title: "Analysis 2026 — F1 InsightX" },
    { name: "description", content: "Explore 2026 race results, winners, podiums and full race analysis." },
  ] }),
  errorComponent: ({ error }) => <SiteShell fullWidth><div className="analysis-page analysis-error" role="alert">Analysis unavailable: {error.message}</div></SiteShell>,
  component: AnalysisIndex,
});

type WeekendIndex = NonNullable<Awaited<ReturnType<typeof getWeekendIndex>>>;
type Weekend = WeekendIndex["weekends"][number];
type View = "completed" | "all" | "upcoming";
const portrait = (code?: string | null, full = false) => code
  ? `/assets/drivers/2026/${full ? "full-body/front" : "headshots"}/${code.toUpperCase() === "MAX" ? "ver" : code.toLowerCase()}.png`
  : null;

function DriverPhoto({ code, name, large = false }: { code?: string | null; name?: string | null; large?: boolean }) {
  const src = portrait(code, large);
  return src ? <img className={large ? "analysis-driver-hero" : "analysis-driver-thumb"} src={src} alt={name ?? code ?? "Driver"} loading={large ? "eager" : "lazy"} onError={(event) => { event.currentTarget.style.display = "none"; }} /> : null;
}

function AnalysisIndex() {
  const { data } = useSuspenseQuery(indexQuery);
  const weekends = useMemo(() => [...data.weekends].sort((a, b) => a.round - b.round), [data.weekends]);
  const completed = useMemo(() => weekends.filter((race) => race.hasRace), [weekends]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<View>("completed");
  const [search, setSearch] = useState("");
  const selected = weekends.find((race) => race.raceId === selectedId) ?? completed.at(-1) ?? weekends[0];
  const filtered = weekends.filter((race) => {
    if (view === "completed" && !race.hasRace) return false;
    if (view === "upcoming" && race.hasRace) return false;
    const term = search.trim().toLowerCase();
    return !term || `${race.name} ${race.circuit} ${race.winnerName ?? ""} ${race.winnerCode ?? ""}`.toLowerCase().includes(term);
  });
  const reportList = [...filtered].reverse();
  const winnerTeam = team(selected?.winnerTeam);

  return <SiteShell fullWidth><main className="analysis-page"><div className="analysis-wrap">
    <header className="analysis-heading">
      <div><div className="analysis-title-line"><h1>Analysis</h1><span>{data.season} season</span></div><p>Every race, in focus.</p></div>
      <div className="analysis-heading-count"><strong>{completed.length}</strong><span>race reports</span></div>
    </header>
    <div className="analysis-workspace">
      <section className="analysis-feature" aria-label="Selected race">
        {selected ? <>
          <div className="analysis-feature-image" aria-hidden="true"><DriverPhoto code={selected.winnerCode} name={selected.winnerName} large /></div>
          <div className="analysis-feature-content">
            <div className="analysis-overline"><span>{selected.hasRace ? "Race report" : "Upcoming race"}</span><span>R{String(selected.round).padStart(2, "0")}</span></div>
            <h2>{selected.name.replace(/ Grand Prix$/i, "")}<small>Grand Prix</small></h2>
            <div className="analysis-race-meta"><span><Calendar width={15} height={15} /> {selected.scheduledAt ? fmtDate(selected.scheduledAt) : "TBC"}</span><span>{selected.circuit}</span></div>
            <div className="analysis-result">{selected.hasRace ? <>
              <div className="analysis-result-head"><Trophy width={18} height={18} /><span>Winner</span></div>
              <div className="analysis-winner"><span>{selected.winnerName ?? selected.winnerCode ?? "Result pending"}</span>{winnerTeam.logoPng && <img src={winnerTeam.logoPng} alt={winnerTeam.name} />}</div>
              <span className="analysis-team-name">{winnerTeam.name}</span>
              {selected.podium.length > 1 && <div className="analysis-podium">{selected.podium.slice(1, 3).map((code, index) => <div key={`${code}-${index}`}><span>0{index + 2}</span><DriverPhoto code={code} /><strong>{code}</strong></div>)}</div>}
            </> : <p className="analysis-awaiting">Report pending</p>}</div>
            {selected.hasRace && selected.slug && <Link className="analysis-primary-link" to="/analysis/$slug" params={{ slug: selected.slug }}>Open report <ArrowRight width={18} height={18} /></Link>}
          </div>
        </> : <p className="analysis-empty">No races available.</p>}
      </section>
      <aside className="analysis-race-picker" aria-label="Select a race">
        <div className="analysis-picker-head"><h2>{data.season} season</h2><select value={view} onChange={(event) => setView(event.target.value as View)} aria-label="Filter races"><option value="completed">Reports</option><option value="all">All races</option><option value="upcoming">Upcoming</option></select></div>
        <label className="analysis-search"><Search width={17} height={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a race" aria-label="Find a race" /></label>
        <div className="analysis-picker-list">{[...filtered].reverse().map((race) => <button key={race.raceId} type="button" className={selected?.raceId === race.raceId ? "is-active" : ""} onClick={() => setSelectedId(race.raceId)} aria-pressed={selected?.raceId === race.raceId}><span className="analysis-round">R{race.round}</span><span className="analysis-picker-name">{race.name}</span><span className="analysis-picker-date">{race.scheduledAt ? fmtDate(race.scheduledAt) : "TBC"}</span><ArrowRight width={16} height={16} /></button>)}</div>
        {filtered.length === 0 && <p className="analysis-empty">No races found.</p>}
      </aside>
    </div>
    <section className="analysis-reports" aria-label="Race reports">
      <div className="analysis-section-head"><h2>{view === "upcoming" ? "Upcoming races" : "Race reports"}</h2><span>{reportList.length} / {weekends.length}</span></div>
      <div className="analysis-report-list">{reportList.map((race) => {
        const t = team(race.winnerTeam);
        const content = <><span className="analysis-report-round">R{String(race.round).padStart(2, "0")}</span><DriverPhoto code={race.winnerCode} name={race.winnerName} /><span className="analysis-report-race"><strong>{race.name}</strong><small>{race.scheduledAt ? fmtDate(race.scheduledAt) : "TBC"} <i>·</i> {race.circuit}</small></span><span className="analysis-report-winner">{race.hasRace ? race.winnerName ?? race.winnerCode : "Scheduled"}</span><span className="analysis-report-team">{race.hasRace && t.logoPng && <img src={t.logoPng} alt="" />} {race.hasRace ? t.name : ""}</span><ArrowRight width={18} height={18} /></>;
        return race.hasRace && race.slug
          ? <Link key={race.raceId} className="analysis-report-row" to="/analysis/$slug" params={{ slug: race.slug }}>{content}</Link>
          : <button type="button" key={race.raceId} className="analysis-report-row" onClick={() => { setSelectedId(race.raceId); window.scrollTo({ top: 0, behavior: "smooth" }); }}>{content}</button>;
      })}</div>
    </section>
  </div></main></SiteShell>;
}
