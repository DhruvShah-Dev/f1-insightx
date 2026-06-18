"use client";

import { useState } from "react";
import type { AchievementEntry, AchievementMetric } from "@/lib/server/achievements-product";

type ChampionshipLeaderboardsProps = {
  metrics: AchievementMetric[];
};

function formatValue(value: number, unit: string) {
  const formatted = Number.isInteger(value) ? value.toLocaleString("en-US") : value.toFixed(1);
  return `${formatted} ${unit}`;
}

function MetricPodium({ entries, unit }: { entries: AchievementEntry[]; unit: string }) {
  const podium = [entries[1], entries[0], entries[2]].filter(Boolean);

  return (
    <div className="championship-metric-podium" aria-label="Top three">
      {podium.map((entry) => (
        <div
          className={`championship-metric-podium__place championship-metric-podium__place--p${entry.rank}`}
          key={entry.driverCode}
        >
          <span>#{entry.rank}</span>
          <strong>{entry.driverCode}</strong>
          <small>{entry.driverName}</small>
          <em>{formatValue(entry.value, unit)}</em>
        </div>
      ))}
    </div>
  );
}

function LeaderboardChart({ metric }: { metric: AchievementMetric }) {
  const chartEntries = metric.entries.slice(0, 12);
  const maxValue = chartEntries[0]?.value ?? 0;

  return (
    <div className="championship-overlay-chart" aria-label={`${metric.title} chart`}>
      {chartEntries.map((entry) => {
        const width = maxValue > 0 ? Math.max(6, (entry.value / maxValue) * 100) : 0;
        return (
          <div className="championship-overlay-chart__row" key={`chart-${metric.id}-${entry.driverCode}`}>
            <span>{entry.driverCode}</span>
            <div>
              <i style={{ width: `${width}%` }} />
            </div>
            <strong>{formatValue(entry.value, metric.unit)}</strong>
          </div>
        );
      })}
    </div>
  );
}

function FullLeaderboard({ metric }: { metric: AchievementMetric }) {
  return (
    <ol className="championship-overlay-list">
      {metric.entries.map((entry) => (
        <li key={`${metric.id}-${entry.driverCode}`}>
          <span>#{entry.rank}</span>
          <div>
            <strong>{entry.driverName}</strong>
            <small>{entry.teamName}</small>
          </div>
          <em>{entry.driverCode}</em>
          <b>{formatValue(entry.value, metric.unit)}</b>
        </li>
      ))}
    </ol>
  );
}

export function ChampionshipLeaderboards({ metrics }: ChampionshipLeaderboardsProps) {
  const [selectedMetric, setSelectedMetric] = useState<AchievementMetric | null>(null);

  return (
    <>
      <section className="championship-metric-grid" aria-label="Championship performance metrics">
        {metrics.map((metric) => (
          <article className="championship-metric-card" key={metric.id}>
            <div className="championship-metric-card__header">
              <div>
                <span>{metric.sourceLabel}</span>
                <h2>{metric.title}</h2>
              </div>
              <p>{metric.description}</p>
            </div>
            {metric.entries.length > 0 ? (
              <>
                <MetricPodium entries={metric.entries.slice(0, 3)} unit={metric.unit} />
                <button
                  className="championship-open-button"
                  type="button"
                  onClick={() => setSelectedMetric(metric)}
                >
                  View full leaderboard
                  <span>{metric.entries.length} drivers</span>
                </button>
              </>
            ) : (
              <div className="achievements-empty">No non-zero driver totals are available for this metric.</div>
            )}
          </article>
        ))}
      </section>

      {selectedMetric ? (
        <div
          className="championship-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="championship-overlay-title"
        >
          <button
            className="championship-overlay__backdrop"
            type="button"
            aria-label="Close leaderboard"
            onClick={() => setSelectedMetric(null)}
          />
          <section className="championship-overlay__panel">
            <header className="championship-overlay__header">
              <div>
                <span>{selectedMetric.sourceLabel}</span>
                <h2 id="championship-overlay-title">{selectedMetric.title}</h2>
                <p>{selectedMetric.description}</p>
              </div>
              <button type="button" onClick={() => setSelectedMetric(null)}>
                Close
              </button>
            </header>
            <LeaderboardChart metric={selectedMetric} />
            <FullLeaderboard metric={selectedMetric} />
          </section>
        </div>
      ) : null}
    </>
  );
}
