import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteShell } from "@/components/site-shell";
import { RaceWeekTrack } from "@/components/race-week-track";
import { fmtLapMs, fmtLapS } from "@/lib/format";
import { getRaceWeek } from "@/lib/f1.functions";
import { pageSeo } from "@/lib/seo";
import "./raceweek.css";

const raceWeekQuery = queryOptions({
  queryKey: ["race-week"],
  queryFn: () => getRaceWeek(),
  staleTime: 60_000,
  refetchInterval: 120_000,
  refetchOnWindowFocus: true,
});

export const Route = createFileRoute("/raceweek")({
  loader: ({ context }) => context.queryClient.ensureQueryData(raceWeekQuery),
  head: () => pageSeo({
    title: "F1 Race Week: Track, Schedule and Predictions | F1 InsightX",
    description: "Explore the next F1 circuit, weekend countdown, qualifying and race predictions, and session evidence as it arrives.",
    path: "/raceweek",
  }),
  component: RaceWeek,
});

function useClock() {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function timeInZone(iso: string, timeZone?: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short", timeZone,
  }).format(new Date(iso));
}

function countdown(target: string, now: number) {
  const seconds = Math.max(0, Math.floor((new Date(target).getTime() - now) / 1_000));
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  return `${days ? `${days}d ` : ""}${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds % 60).padStart(2, "0")}s`;
}

function RaceWeek() {
  const { data } = useSuspenseQuery(raceWeekQuery);
  const now = useClock();
  if (!data) return <SiteShell fullWidth><p role="alert">Race week data is unavailable.</p></SiteShell>;

  const sessions = [...data.sessions].sort((a, b) => a.startISO.localeCompare(b.startISO));
  const nextSession = sessions.find((session) => new Date(session.startISO).getTime() > now);
  const qualifying = [...data.qualifyingPredictions].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  const qualifyingResult = new Map(data.qualifyingResults.map((row) => [row.driverId, row]));
  const raceResult = new Map(data.raceResults.map((row) => [row.driverId, row]));
  const frozenRaceRank = new Map(data.frozenRaceRanks.map((row) => [row.driverId, row]));
  const raceStarted = now > 0 && new Date(data.scheduledAt).getTime() <= now;
  const race = [...data.projections].sort((a, b) =>
    (raceStarted ? frozenRaceRank.get(a.driverId)?.rank ?? a.projected ?? 99 : a.projected ?? 99) -
    (raceStarted ? frozenRaceRank.get(b.driverId)?.rank ?? b.projected ?? 99 : b.projected ?? 99),
  );
  const predictedPoleS = Math.min(...qualifying.map((row) => row.timeS ?? Infinity));
  const maxQualifyingGap = Math.max(0.1, ...qualifying.map((row) => row.timeS == null ? 0 : row.timeS - predictedPoleS));
  const latestPractice = [...sessions].reverse().find((session) => /^FP\d$/.test(session.code) && data.practicePace.some((row) => row.sessionCode === session.code));
  const practiceRows = data.practicePace.filter((row) => row.sessionCode === latestPractice?.code);
  const practiceBest = Math.min(...practiceRows.map((row) => row.bestLapS ?? Infinity));
  const practiceWorst = Math.max(...practiceRows.map((row) => row.bestLapS ?? 0));
  const previous = data.previous[0];

  return <SiteShell fullWidth><main className="rw-page">
    <header className="rw-heading">
      <div><p className="rw-overline">Race week / Round {data.round} of {data.season}</p><h1>{data.raceName}</h1><p className="rw-subtitle">{data.circuit.name} · {data.circuit.location ?? data.circuit.country}</p></div>
      <div className="rw-countdown">
        <span>{nextSession ? `Next: ${nextSession.label}` : data.raceResults.length ? "Race complete" : "Weekend schedule complete"}</span>
        <strong>{nextSession && now ? countdown(nextSession.startISO, now) : nextSession ? "Loading countdown" : data.raceResults.length ? "Results available" : "Awaiting results"}</strong>
        {nextSession ? <small>{timeInZone(nextSession.startISO, data.venueTimeZone)}</small> : null}
      </div>
    </header>

    <section className="rw-section" aria-labelledby="track-title">
      <div className="rw-section-heading"><div><p className="rw-overline">01 / The circuit</p><h2 id="track-title">Track layout</h2></div><p>Official circuit facts with source-backed markers.</p></div>
      <RaceWeekTrack path={data.trackPath} reference={data.trackReference} name={data.circuit.name} lengthKm={data.circuit.lengthKm} />
    </section>

    <section className="rw-section" aria-labelledby="schedule-title">
      <div className="rw-section-heading"><div><p className="rw-overline">02 / The weekend</p><h2 id="schedule-title">Session schedule</h2></div><p>Venue time and your local time. The next session is counted down above.</p></div>
      {sessions.length ? <ol className="rw-schedule">
        {sessions.map((session) => {
          const started = now > 0 && new Date(session.startISO).getTime() <= now;
          const status = session.status === "complete" ? "Result available" : started ? "Data pending" : "Scheduled";
          return <li key={session.code} className={nextSession?.code === session.code ? "rw-next-session" : ""}>
            <span className="rw-session-code">{session.code}</span><strong>{session.label}</strong>
            <span>{timeInZone(session.startISO, data.venueTimeZone)}<small>Venue</small></span>
            <span>{now ? timeInZone(session.startISO) : "Local time loading"}<small>Your time</small></span><em>{status}</em>
          </li>;
        })}
      </ol> : <p className="rw-empty">The detailed session schedule is pending. Race start: {timeInZone(data.scheduledAt, data.venueTimeZone)}.</p>}
    </section>

    <section className="rw-section" aria-labelledby="quali-title">
      <div className="rw-section-heading"><div><p className="rw-overline">03 / One lap</p><h2 id="quali-title">Qualifying prediction</h2></div><p>Ranked by predicted gap to pole. Results appear beside the baseline after qualifying.</p></div>
      <p className="rw-source-line">Pre-session baseline · {data.qualifyingPredictionGeneratedAt ? `Race-week build ${timeInZone(data.qualifyingPredictionGeneratedAt, "UTC")}` : "Build time unavailable"} · {qualifying[0]?.qualityNote ?? "Model estimate"}</p>
      {qualifying.length ? <div className="rw-forecast-list">
        {qualifying.map((row, index) => {
          const observed = qualifyingResult.get(row.driverId);
          const gap = row.timeS == null || !Number.isFinite(predictedPoleS) ? null : row.timeS - predictedPoleS;
          return <div className="rw-quali-row" key={row.driverId}>
            <span className="rw-rank">{row.rank ?? index + 1}</span><span className="rw-name"><strong>{row.name}</strong><small>{row.team}{row.sourceUsefulnessScore == null ? "" : ` · signal score ${row.sourceUsefulnessScore.toFixed(2)}`}</small></span>
            <div className="rw-gap-cell"><span className="rw-gap-track"><i style={{ left: `${Math.min(100, Math.max(0, (gap ?? 0) / maxQualifyingGap * 100))}%` }} /></span><strong>{gap == null ? "—" : `+${gap.toFixed(3)}s`}</strong></div>
            <span className="rw-predicted-time">{fmtLapS(row.timeS)}</span><span className="rw-observed">{observed ? `Actual P${observed.position ?? "—"} · ${fmtLapMs(observed.timeMs)}` : ""}</span>
          </div>;
        })}
      </div> : <p className="rw-empty">Qualifying projection pending.</p>}
    </section>

    <section className="rw-section" aria-labelledby="race-title">
      <div className="rw-section-heading"><div><p className="rw-overline">04 / Race day</p><h2 id="race-title">Race prediction & strategy</h2></div><p>Projected finish range and estimated pit window; probabilities are withheld pending calibration.</p></div>
      <p className="rw-source-line">Pre-race snapshot · {data.predictionGeneratedAt ? timeInZone(data.predictionGeneratedAt, "UTC") : "Build time unavailable"} · estimates, not official timing</p>
      {race.length ? <div className="rw-race-list">
        {race.map((row, index) => {
          const observed = raceResult.get(row.driverId);
          const strategy = data.strategy.find((item) => item.driverId === row.driverId);
          const frozen = frozenRaceRank.get(row.driverId);
          const rank = raceStarted ? frozen?.rank ?? row.projected : row.projected;
          return <div className="rw-race-row" key={row.driverId}>
            <span className="rw-rank">{rank ?? index + 1}</span><span className="rw-name"><strong>{row.name}</strong><small>{row.team}{row.confidence == null ? "" : ` · model score ${row.confidence.toFixed(2)}`}</small></span>
            <span className="rw-finish-band">{!raceStarted && row.low != null && row.high != null ? `P${row.low}–P${row.high}` : "Baseline rank"}<small>Finish range</small></span>
            <span className="rw-pit-window">{strategy?.windowStart != null && strategy.windowEnd != null ? `L${strategy.windowStart}–${strategy.windowEnd}` : "Pending"}<small>Estimated pit window</small>{strategy?.windowStart != null && strategy.windowEnd != null && data.trackReference ? <span className="rw-window-track"><i style={{ left: `${strategy.windowStart / data.trackReference.laps * 100}%`, width: `${(strategy.windowEnd - strategy.windowStart) / data.trackReference.laps * 100}%` }} /></span> : null}</span>
            <span className="rw-observed">{observed ? `Actual P${observed.position ?? "—"}` : ""}</span>
          </div>;
        })}
      </div> : <p className="rw-empty">Race projection pending.</p>}
      {data.raceResults.length && previous?.slug && previous.round === data.round && previous.season === data.season ? <Link className="rw-analysis-link" to="/analysis/$slug" params={{ slug: previous.slug }}>Read race analysis ↗</Link> : null}
    </section>

    <section className="rw-section rw-evidence" aria-labelledby="evidence-title">
      <div className="rw-section-heading"><div><p className="rw-overline">05 / Session evidence</p><h2 id="evidence-title">What changed this weekend</h2></div><p>Practice comparisons appear only after validated current-weekend data is published.</p></div>
      {latestPractice && practiceRows.length ? <>
        <p className="rw-source-line">Latest practice: {latestPractice.label} · best lap and top speed are observed; long-run pace and degradation are derived.</p>
        <div className="rw-practice-table"><div className="rw-practice-head"><span>Driver</span><span>Best lap</span><span>Long run</span><span>Tyre fade</span><span>Top speed</span></div>
          {[...practiceRows].sort((a, b) => (a.bestLapS ?? 999) - (b.bestLapS ?? 999)).slice(0, 10).map((row) => <div className="rw-practice-row" key={row.driverId}>
            <strong>{row.name}</strong><span>{fmtLapS(row.bestLapS)}<i className="rw-practice-bar" style={{ width: `${row.bestLapS == null || !Number.isFinite(practiceBest) ? 0 : 100 - (row.bestLapS - practiceBest) / Math.max(0.001, practiceWorst - practiceBest) * 75}%` }} /></span><span>{fmtLapS(row.longRunS)}</span><span>{row.degradationS == null ? "—" : `${row.degradationS.toFixed(2)}s/lap`}</span><span>{row.topSpeedKph == null ? "—" : `${Math.round(row.topSpeedKph)} km/h`}</span>
          </div>)}
        </div>
      </> : <p className="rw-empty">No validated practice data for this race yet. The predictions above use pre-weekend evidence.</p>}
      {data.historicalMovement.length ? <div className="rw-history-chart">
        <h3>{data.historicalRaceLabel}: grid to finish</h3>
        <p className="rw-source-line">Historical race result, not a current-weekend prediction. Positions come from curated race results.</p>
        <div className="rw-history-rows">{data.historicalMovement.map((row) => {
          const gain = row.grid - row.finish;
          return <div key={row.driverId} className="rw-history-row"><span>{row.name}</span><span>P{row.grid} → P{row.finish}</span><strong className={gain > 0 ? "rw-gain" : ""}>{gain > 0 ? `+${gain}` : gain} places</strong><i style={{ width: `${Math.min(100, Math.abs(gain) / 19 * 100 + 8)}%` }} /></div>;
        })}</div>
      </div> : null}
      {previous?.slug ? <p className="rw-history-link">Historical context: <Link to="/analysis/$slug" params={{ slug: previous.slug }}>Explore the previous {data.circuit.name} race analysis ↗</Link>. Prior telemetry describes past sessions, not this weekend.</p> : null}
    </section>
  </main></SiteShell>;
}
