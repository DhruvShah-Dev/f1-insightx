"use client";

import { useMemo, useState, type CSSProperties } from "react";

export type PositionMovementPoint = {
  lap: number;
  position: number;
  phase: string;
  status: string;
};

export type PositionMovementSeries = {
  driver: string;
  team: string;
  color: string;
  secondaryColor: string;
  finalPosition: number | null;
  startPosition: number | null;
  positionDelta: number | null;
  points: PositionMovementPoint[];
};

type PositionMovementExplorerProps = {
  series: PositionMovementSeries[];
  defaultDrivers: string[];
  maxLap: number;
  fieldSize: number;
};

const chart = {
  width: 1000,
  height: 420,
  left: 62,
  right: 34,
  top: 34,
  bottom: 46,
};

function xForLap(lap: number, maxLap: number) {
  const span = chart.width - chart.left - chart.right;
  return chart.left + (Math.max(0, Math.min(maxLap, lap)) / Math.max(1, maxLap)) * span;
}

function yForPosition(position: number, fieldSize: number) {
  const span = chart.height - chart.top - chart.bottom;
  return chart.top + ((Math.max(1, Math.min(fieldSize, position)) - 1) / Math.max(1, fieldSize - 1)) * span;
}

function pathFor(points: PositionMovementPoint[], maxLap: number, fieldSize: number) {
  return points
    .filter((point) => Number.isFinite(point.lap) && Number.isFinite(point.position))
    .map((point, index) => {
      const command = index === 0 ? "M" : "L";
      return `${command}${xForLap(point.lap, maxLap).toFixed(1)} ${yForPosition(point.position, fieldSize).toFixed(1)}`;
    })
    .join(" ");
}

function signedPositions(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "n/a";
  if (value === 0) return "0";
  return `${value > 0 ? "+" : ""}${value}`;
}

export function PositionMovementExplorer({
  series,
  defaultDrivers,
  maxLap,
  fieldSize,
}: PositionMovementExplorerProps) {
  const [selectedDrivers, setSelectedDrivers] = useState(() => new Set(defaultDrivers));
  const selectedSeries = useMemo(
    () => series.filter((item) => selectedDrivers.has(item.driver)),
    [selectedDrivers, series],
  );
  const lapTicks = [1, Math.max(1, Math.round(maxLap * 0.25)), Math.max(1, Math.round(maxLap * 0.5)), Math.max(1, Math.round(maxLap * 0.75)), maxLap];
  const positionTicks = [1, 5, 10, 15, 20].filter((position) => position <= fieldSize);

  function toggleDriver(driver: string) {
    setSelectedDrivers((current) => {
      const next = new Set(current);
      if (next.has(driver)) {
        next.delete(driver);
      } else {
        next.add(driver);
      }
      return next;
    });
  }

  return (
    <div className="race-cinema-position-explorer">
      <div className="race-cinema-position-chart" aria-label="Lap-position movement chart">
        <svg viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-labelledby="position-chart-title position-chart-desc">
          <title id="position-chart-title">Position movement by lap</title>
          <desc id="position-chart-desc">Selected drivers plotted by lap number and running position, with position one at the top.</desc>
          <rect className="race-cinema-position-chart__plot" x={chart.left} y={chart.top} width={chart.width - chart.left - chart.right} height={chart.height - chart.top - chart.bottom} />
          {lapTicks.map((lap) => {
            const x = xForLap(lap, maxLap);
            return (
              <g key={`lap-${lap}`} className="race-cinema-position-chart__tick">
                <line x1={x} x2={x} y1={chart.top} y2={chart.height - chart.bottom} />
                <text x={x} y={chart.height - 16}>L{lap}</text>
              </g>
            );
          })}
          {positionTicks.map((position) => {
            const y = yForPosition(position, fieldSize);
            return (
              <g key={`pos-${position}`} className="race-cinema-position-chart__rank">
                <line x1={chart.left} x2={chart.width - chart.right} y1={y} y2={y} />
                <text x={26} y={y + 4}>P{position}</text>
              </g>
            );
          })}
          {selectedSeries.map((item) => {
            const path = pathFor(item.points, maxLap, fieldSize);
            const first = item.points[0];
            const last = item.points.at(-1);
            return (
              <g className="race-cinema-position-series" key={item.driver} style={{ "--driver-team-primary": item.color } as CSSProperties}>
                <path d={path} />
                {first ? <circle cx={xForLap(first.lap, maxLap)} cy={yForPosition(first.position, fieldSize)} r="5.2" /> : null}
                {last ? (
                  <>
                    <circle cx={xForLap(last.lap, maxLap)} cy={yForPosition(last.position, fieldSize)} r="6.2" />
                    <text x={Math.min(chart.width - 92, xForLap(last.lap, maxLap) + 10)} y={yForPosition(last.position, fieldSize) + 4}>
                      {item.driver} P{item.finalPosition ?? last.position}
                    </text>
                  </>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="race-cinema-position-controls" aria-label="Driver selection">
        <div>
          <span>Driver lines</span>
          <strong>Top 5 are shown by default</strong>
        </div>
        <div className="race-cinema-position-controls__grid">
          {series.map((item) => (
            <label
              key={item.driver}
              style={{
                "--driver-team-primary": item.color,
                "--driver-team-secondary": item.secondaryColor,
              } as CSSProperties}
            >
              <input
                type="checkbox"
                checked={selectedDrivers.has(item.driver)}
                onChange={() => toggleDriver(item.driver)}
              />
              <span>{item.finalPosition ? `P${item.finalPosition}` : "--"}</span>
              <strong>{item.driver}</strong>
              <small>{item.team} / {signedPositions(item.positionDelta)} pos</small>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
