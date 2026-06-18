import { notFound } from "next/navigation";
import { CircuitHeroPanel } from "@/components/races/circuit-hero-panel";
import { StatePanel } from "@/components/ui/state-panel";
import { SiteFooter } from "@/components/ui/site-footer";
import { TeamBadge } from "@/components/ui/team-badge";
import { logServerError } from "@/lib/errors/logger";
import { getRaceDetail } from "@/lib/server/race-history";

type Props = {
  params: Promise<{
    raceId: string;
  }>;
};

export default async function RaceDetailPage({ params }: Props) {
  const { raceId } = await params;
  let detail = null;
  try {
    detail = await getRaceDetail(raceId);
  } catch (error) {
    logServerError("page:race-detail", error, { raceId });
    return (
      <main className="subpage-shell">
        <StatePanel
          eyebrow="Race detail"
          title="This race weekend could not be loaded."
          message="The archive record is temporarily unavailable. Try again in a moment."
          tone="error"
          actionHref="/"
          actionLabel="Back to homepage"
        />
      </main>
    );
  }

  if (!detail) {
    notFound();
  }

  return (
    <main className="subpage-shell race-detail-layout">
      <CircuitHeroPanel detail={detail} />

      <section className="race-detail-hero">
        <div className="workspace-panel workspace-panel--dark">
          <div className="workspace-panel__eyebrow">Race summary</div>
          <div className="workspace-panel__headline">
            {detail.winner ? `${detail.winner.driverName} won from ${detail.pole?.driverName ?? "pole"}.` : detail.displayName}
          </div>
          <div className="result-summary">
            <div>
              <span>Winner</span>
              <strong>{detail.winner?.driverName ?? "-"}</strong>
            </div>
            <div>
              <span>Fastest lap</span>
              <strong>{detail.fastestLap?.driverName ?? "-"}</strong>
            </div>
            <div>
              <span>Pole</span>
              <strong>{detail.pole?.driverName ?? "-"}</strong>
            </div>
          </div>
          <div className="race-podium">
            {detail.podium.map((entry, index) => (
              <div key={entry.driverId} className="race-podium__item">
                <span>P{index + 1}</span>
                <strong>{entry.driverName}</strong>
                <TeamBadge teamId={entry.constructorId} compact />
              </div>
            ))}
          </div>
        </div>

        <div className="workspace-panel">
          <div className="workspace-panel__eyebrow">Weekend context</div>
          <div className="workspace-panel__headline">Key markers from the event.</div>
          <div className="context-list">
            <div className="context-list__item">
              <div>
                <strong>Circuit</strong>
                <p>{detail.circuit.name}</p>
              </div>
            </div>
            <div className="context-list__item">
              <div>
                <strong>Location</strong>
                <p>
                  {detail.circuit.location ?? "Unavailable"}
                  {detail.circuit.country ? `, ${detail.circuit.country}` : ""}
                </p>
              </div>
            </div>
            <div className="context-list__item">
              <div>
                <strong>Sprint weekend</strong>
                <p>{detail.sprintWeekend ? "Yes" : "No"}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="subpage-grid race-detail-grid">
        <div className="workspace-panel workspace-panel--dark">
          <div className="workspace-panel__eyebrow">Classification</div>
          <div className="workspace-panel__headline">Points and finishing order.</div>
          <div className="result-table">
            {detail.classification.map((entry) => (
              <article key={entry.driverId} className="result-row">
                <div className="result-row__rank">{entry.position ?? "-"}</div>
                <div className="result-row__main">
                  <div className="result-row__head">
                    <div>
                      <h3>{entry.driverName}</h3>
                      <p>
                        Grid {entry.gridPosition ?? "-"} | {entry.status ?? "Classified"}
                      </p>
                      <div className="mt-3">
                        <TeamBadge teamId={entry.constructorId} compact />
                      </div>
                    </div>
                    <div className="result-row__metrics">
                      <span>{entry.points} pts</span>
                      {entry.fastestLapRank === 1 ? <span>Fastest lap</span> : null}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="section-stack">
          <div className="workspace-panel">
            <div className="workspace-panel__eyebrow">Qualifying</div>
            <div className="workspace-panel__headline">Pole and front-row context.</div>
            <div className="context-list">
              {detail.qualifyingTopThree.map((entry, index) => (
                <div key={entry.driverId} className="context-list__item">
                  <div>
                    <strong>
                      P{index + 1} {entry.driverName}
                    </strong>
                    <p>{entry.constructorName}</p>
                  </div>
                  <TeamBadge teamId={entry.constructorId} compact />
                </div>
              ))}
            </div>
          </div>

          <div className="workspace-panel">
            <div className="workspace-panel__eyebrow">Constructors</div>
            <div className="workspace-panel__headline">Team totals from the race.</div>
            <div className="context-list">
              {detail.constructorResults.map((entry) => (
                <div key={entry.constructorId} className="context-list__item">
                  <div>
                    <strong>{entry.constructorName}</strong>
                    <p>{entry.drivers.join(" / ")}</p>
                  </div>
                  <div className="context-metrics">
                    <TeamBadge teamId={entry.constructorId} compact />
                    <span>{entry.totalPoints} pts</span>
                    <span>best p{entry.bestFinish ?? "-"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {detail.sprint ? (
            <div className="workspace-panel">
              <div className="workspace-panel__eyebrow">Sprint</div>
              <div className="workspace-panel__headline">Sprint classification.</div>
              <div className="context-list">
                {detail.sprint.classification.slice(0, 8).map((entry) => (
                  <div key={entry.driverId} className="context-list__item">
                    <div>
                      <strong>
                        P{entry.position ?? "-"} {entry.driverName}
                      </strong>
                      <p>{entry.constructorName}</p>
                    </div>
                    <div className="context-metrics">
                      <TeamBadge teamId={entry.constructorId} compact />
                      <span>{entry.points} pts</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
