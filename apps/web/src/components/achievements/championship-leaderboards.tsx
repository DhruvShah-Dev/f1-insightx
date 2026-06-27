"use client";

import { useMemo, useState, type CSSProperties } from "react";
import type { AchievementEntry, AchievementMetric } from "@/lib/server/achievements-product";
import { getTeamAsset } from "@/lib/ui/asset-manifest";

type ChampionshipLeaderboardsProps = {
  metrics: AchievementMetric[];
};

function formatValue(value: number, unit: string) {
  const formatted = Number.isInteger(value) ? value.toLocaleString("en-US") : value.toFixed(1);
  return `${formatted} ${unit}`;
}

function metricCaveat(metric: AchievementMetric) {
  if (["overtakes", "positionsGained", "positionsLost"].includes(metric.id)) {
    return "Proxy-derived from race-analysis movement data.";
  }

  if (metric.id === "pitStops") {
    return "Compiled from generated pit-strategy rows.";
  }

  return metric.sourceLabel;
}

function entryStyle(entry: AchievementEntry, maxValue: number) {
  const team = getTeamAsset(entry.teamName);
  const width = maxValue > 0 ? Math.max(5, (entry.value / maxValue) * 100) : 0;

  return {
    "--team-primary": team.primary,
    "--team-secondary": team.secondary,
    "--team-accent": team.accent,
    "--bar-size": `${width}%`,
  } as CSSProperties;
}

function MetricPodium({ entries, unit }: { entries: AchievementEntry[]; unit: string }) {
  const podium = [entries[1], entries[0], entries[2]].filter(Boolean);
  const maxValue = entries[0]?.value ?? 0;

  return (
    <div className="champ-cinema-metric-podium" aria-label="Top three">
      {podium.map((entry) => (
        <div
          className={`champ-cinema-metric-podium__place champ-cinema-metric-podium__place--p${entry.rank}`}
          key={entry.driverCode}
          style={entryStyle(entry, maxValue)}
        >
          <span>#{entry.rank}</span>
          <strong>{entry.driverCode}</strong>
          <small>{entry.driverName}</small>
          <em>{formatValue(entry.value, unit)}</em>
          <i aria-hidden="true" />
        </div>
      ))}
    </div>
  );
}

function MetricBars({ metric }: { metric: AchievementMetric }) {
  const chartEntries = metric.entries.slice(0, 12);
  const maxValue = chartEntries[0]?.value ?? 0;

  return (
    <div className="champ-cinema-metric-bars" aria-label={`${metric.title} top twelve`}>
      {chartEntries.map((entry) => (
        <div
          className="champ-cinema-metric-bars__row"
          key={`chart-${metric.id}-${entry.driverCode}`}
          style={entryStyle(entry, maxValue)}
        >
          <span>{entry.rank}</span>
          <strong>{entry.driverCode}</strong>
          <div aria-hidden="true">
            <i />
          </div>
          <em>{formatValue(entry.value, metric.unit)}</em>
        </div>
      ))}
    </div>
  );
}

function FullLeaderboard({ metric }: { metric: AchievementMetric }) {
  const maxValue = metric.entries[0]?.value ?? 0;

  return (
    <ol className="champ-cinema-overlay-list">
      {metric.entries.map((entry) => (
        <li key={`${metric.id}-${entry.driverCode}`} style={entryStyle(entry, maxValue)}>
          <span>#{entry.rank}</span>
          <div>
            <strong>{entry.driverName}</strong>
            <small>{entry.teamName}</small>
          </div>
          <em>{entry.driverCode}</em>
          <div className="champ-cinema-points-bar" aria-hidden="true">
            <i />
          </div>
          <b>{formatValue(entry.value, metric.unit)}</b>
        </li>
      ))}
    </ol>
  );
}

export function ChampionshipLeaderboards({ metrics }: ChampionshipLeaderboardsProps) {
  const availableMetrics = useMemo(() => metrics.filter(Boolean), [metrics]);
  const [selectedMetric, setSelectedMetric] = useState<AchievementMetric | null>(null);

  return (
    <>
      <section className="champ-cinema-metric-grid" aria-label="Championship performance metrics">
        {availableMetrics.map((metric) => (
          <article className="champ-cinema-metric-card" key={metric.id}>
            <div className="champ-cinema-metric-card__header">
              <div>
                <span>{metric.sourceLabel}</span>
                <h3>{metric.title}</h3>
              </div>
              <p>{metric.description}</p>
              <small>{metricCaveat(metric)}</small>
            </div>
            {metric.entries.length > 0 ? (
              <>
                <MetricPodium entries={metric.entries.slice(0, 3)} unit={metric.unit} />
                <MetricBars metric={metric} />
                <button
                  className="champ-cinema-open-button"
                  type="button"
                  onClick={() => setSelectedMetric(metric)}
                >
                  View full leaderboard
                  <span>{metric.entries.length} drivers</span>
                </button>
              </>
            ) : (
              <div className="champ-cinema-empty">No non-zero driver totals are available for this metric.</div>
            )}
          </article>
        ))}
      </section>

      {selectedMetric ? (
        <div
          className="champ-cinema-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="champ-cinema-overlay-title"
        >
          <button
            className="champ-cinema-overlay__backdrop"
            type="button"
            aria-label="Close leaderboard"
            onClick={() => setSelectedMetric(null)}
          />
          <section className="champ-cinema-overlay__panel">
            <header className="champ-cinema-overlay__header">
              <div>
                <span>{selectedMetric.sourceLabel}</span>
                <h2 id="champ-cinema-overlay-title">{selectedMetric.title}</h2>
                <p>{selectedMetric.description}</p>
                <small>{metricCaveat(selectedMetric)}</small>
              </div>
              <button type="button" onClick={() => setSelectedMetric(null)}>
                Close
              </button>
            </header>
            <MetricBars metric={selectedMetric} />
            <FullLeaderboard metric={selectedMetric} />
          </section>
        </div>
      ) : null}
    </>
  );
}
