import Link from "next/link";
import { HomeLink } from "@/components/ui/home-link";
import { TeamBadge } from "@/components/ui/team-badge";
import { getRaceWeekOverview, getUpcomingRacePrediction } from "@/lib/server/f1-platform";

export default async function PredictionsPage() {
  const [overview, prediction] = await Promise.all([
    getRaceWeekOverview(),
    getUpcomingRacePrediction(),
  ]);

  const topThree = prediction?.entries.slice(0, 3) ?? [];
  const topTen = prediction?.entries.slice(0, 10) ?? [];

  return (
    <main className="subpage-shell">
      <header className="subpage-header prediction-header">
        <div className="prediction-header__copy">
          <p className="subpage-eyebrow">Race Week Forecast</p>
          <h1 className="subpage-title">
            {prediction?.race.raceName ?? overview?.nextRace?.raceName ?? "Upcoming Grand Prix"} outlook.
          </h1>
          <p className="race-detail__lede">
            A pre-race forecast built from the latest completed round, point-in-time rolling form, constructor momentum, and a reusable weekly prediction snapshot.
          </p>
        </div>
        <div className="prediction-header__meta">
          <div className="prediction-header__card">
            <span>Latest completed</span>
            <strong>{overview?.latestCompletedRace?.raceName ?? "No completed race"}</strong>
          </div>
          <div className="prediction-header__card">
            <span>Next race</span>
            <strong>{overview?.nextRace?.raceName ?? "No upcoming race"}</strong>
          </div>
          <div className="prediction-header__card">
            <span>Model</span>
            <strong>{prediction?.modelVersion ?? "pre_race_ranker_v1"}</strong>
          </div>
          <HomeLink />
        </div>
      </header>

      {prediction ? (
        <div className="prediction-layout">
          <section className="prediction-hero">
            <div className="workspace-panel workspace-panel--results">
              <div className="workspace-panel__eyebrow">Upcoming race</div>
              <div className="workspace-panel__headline">
                {prediction.race.raceName} | {new Date(prediction.race.scheduledAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </div>
              <p className="lab-copy">
                Circuit: {prediction.race.circuitName}
                {prediction.race.circuitCountry ? `, ${prediction.race.circuitCountry}` : ""}
              </p>

              <div className="result-summary">
                <div>
                  <span>Projected winner</span>
                  <strong>{topThree[0]?.driverName ?? "TBD"}</strong>
                </div>
                <div>
                  <span>Best team outlook</span>
                  <strong>{prediction.constructorOutlook[0]?.constructorName ?? "TBD"}</strong>
                </div>
                <div>
                  <span>Snapshot time</span>
                  <strong>{new Date(prediction.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</strong>
                </div>
                <div>
                  <span>Forecast scope</span>
                  <strong>{prediction.entries.length} drivers</strong>
                </div>
              </div>
            </div>
          </section>

          <section className="prediction-grid">
            <div className="workspace-panel">
              <div className="workspace-panel__eyebrow">Podium probability</div>
              <div className="workspace-panel__headline">Front-running picture.</div>
              <div className="race-podium">
                {topThree.map((entry, index) => (
                  <div key={entry.driverId} className="race-podium__item">
                    <span>P{index + 1}</span>
                    <strong>{entry.driverName}</strong>
                    <TeamBadge teamId={entry.constructorId} compact />
                  </div>
                ))}
              </div>
            </div>

            <div className="workspace-panel">
              <div className="workspace-panel__eyebrow">Top team outlook</div>
              <div className="workspace-panel__headline">Constructor shape into the weekend.</div>
              <div className="context-list">
                {prediction.constructorOutlook.slice(0, 5).map((entry) => (
                  <div key={entry.constructorId} className="context-list__item">
                    <div>
                      <strong>{entry.constructorName}</strong>
                      <p>Avg finish {entry.averageProjectedFinish.toFixed(1)}</p>
                    </div>
                    <div className="context-metrics">
                      <TeamBadge teamId={entry.constructorId} compact />
                      <span>win {entry.averageWinnerProbability.toFixed(1)}%</span>
                      <span>pod {entry.totalPodiumProbability.toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="workspace-panel">
            <div className="workspace-panel__eyebrow">Key contenders</div>
            <div className="workspace-panel__headline">The ten names most likely to shape the race.</div>
            <div className="prediction-driver-grid">
              {topTen.map((entry) => (
                <article key={entry.driverId} className="prediction-driver-card">
                  <div className="prediction-driver-card__head">
                    <div>
                      <h3>{entry.driverName}</h3>
                      <p>{entry.nationality ?? "Current field"}</p>
                    </div>
                    <TeamBadge teamId={entry.constructorId} compact />
                  </div>
                  <div className="prediction-driver-card__metrics">
                    <span>Finish P{entry.projectedFinish}</span>
                    <span>Win {entry.winnerProbability.toFixed(1)}%</span>
                    <span>Podium {entry.podiumProbability.toFixed(1)}%</span>
                    <span>Top 10 {entry.top10Probability.toFixed(1)}%</span>
                  </div>
                  <p className="lab-copy">{entry.rationale}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="feature-showcase feature-showcase--prediction-links">
            <div className="feature-showcase__header">
              <div className="feature-showcase__intro">
                <div className="section-meta">Use the forecast</div>
                <h2 className="section-title">Carry the race-week signal into the rest of the product.</h2>
                <p className="section-copy">
                  The same weekly context powers scenario testing in Strategy Lab and lineup value in Fantasy Builder.
                </p>
              </div>
            </div>

            <div className="module-grid feature-showcase__grid">
              <Link href="/lab" className="module-link">
                <span className="module-link__index">01</span>
                <strong className="module-link__title">Open Strategy Lab</strong>
                <p className="module-link__summary">Move one driver or constructor away from the race-week baseline and compare the delta.</p>
              </Link>
              <Link href="/fantasy" className="module-link">
                <span className="module-link__index">02</span>
                <strong className="module-link__title">Open Fantasy Builder</strong>
                <p className="module-link__summary">Use the same prediction-driven field outlook for budget, value, and volatility tradeoffs.</p>
              </Link>
            </div>
          </section>
        </div>
      ) : (
        <section className="workspace-panel">
          <div className="workspace-panel__eyebrow">Race Week Forecast</div>
          <div className="workspace-panel__headline">No upcoming race snapshot is available yet.</div>
          <p className="lab-copy">
            The prediction page is driven by the canonical race-week pipeline. Run the product-view build step after refreshing schedule and results data.
          </p>
        </section>
      )}
    </main>
  );
}

