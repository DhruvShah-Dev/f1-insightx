import type { CSSProperties } from "react";
import type {
  CircuitCornerMarker,
  CircuitDataCallout,
  RaceWeekCircuitMetadata,
} from "@/lib/ui/race-week-circuit-metadata";

type RaceWeekCircuitVisualizationProps = {
  title: string;
  trackPath: string;
  metadata: RaceWeekCircuitMetadata | null;
  showLegend?: boolean;
  showMetadata?: boolean;
};

function getTooltipPosition(marker: CircuitCornerMarker, width: number) {
  const side = marker.tooltipSide ?? "right";

  if (side === "left") {
    return { x: marker.x - width - 15, y: marker.y - 11 };
  }
  if (side === "above") {
    return { x: marker.x - width / 2, y: marker.y - 37 };
  }
  if (side === "below") {
    return { x: marker.x - width / 2, y: marker.y + 15 };
  }
  return { x: marker.x + 15, y: marker.y - 11 };
}

function closeOpenTrackPath(pathData: string) {
  const trimmed = pathData.trim();
  return /z$/i.test(trimmed) ? trimmed : `${trimmed} Z`;
}

function CircuitCallout({ callout }: { callout: CircuitDataCallout }) {
  const boxHeight = 22;
  const lineEndX =
    callout.labelPosition.x > callout.anchor.x
      ? callout.labelPosition.x
      : callout.labelPosition.x + callout.width;
  const lineEndY = callout.labelPosition.y + boxHeight / 2;

  return (
    <g className={`race-week-circuit-callout race-week-circuit-callout--${callout.kind}`}>
      <title>{callout.label}</title>
      <line x1={callout.anchor.x} y1={callout.anchor.y} x2={lineEndX} y2={lineEndY} />
      <circle cx={callout.anchor.x} cy={callout.anchor.y} r="5" />
      <rect
        x={callout.labelPosition.x}
        y={callout.labelPosition.y}
        width={callout.width}
        height={boxHeight}
        rx="2"
      />
      <text x={callout.labelPosition.x + 8} y={callout.labelPosition.y + 14}>
        {callout.label}
      </text>
    </g>
  );
}

export function RaceWeekCircuitVisualization({
  title,
  trackPath,
  metadata,
  showLegend = true,
  showMetadata = true,
}: RaceWeekCircuitVisualizationProps) {
  const viewBox = metadata?.viewBox ?? "0 0 960 620";
  const renderedTrackPath = closeOpenTrackPath(trackPath);
  const sectors = metadata?.sectors ?? [
    { id: "sector-1" as const, label: "Sector 1", startPercent: 0, endPercent: 33.3, color: "#ff3f76" },
    { id: "sector-2" as const, label: "Sector 2", startPercent: 33.3, endPercent: 66.6, color: "#38bdf8" },
    { id: "sector-3" as const, label: "Sector 3", startPercent: 66.6, endPercent: 100, color: "#f6d84a" },
  ];

  return (
    <div className="race-week-sector-track">
      <svg
        viewBox={viewBox}
        className="race-week-sector-track__svg"
        role="img"
        aria-label={`${title} circuit with approximate sectors and circuit feature markers`}
      >
        <path d={renderedTrackPath} className="race-week-sector-track__outer-ribbon" />
        <path d={renderedTrackPath} className="race-week-sector-track__shadow" />
        <path d={renderedTrackPath} className="race-week-sector-track__inner-ribbon" />

        {sectors.map((sector) => {
          const length = sector.endPercent - sector.startPercent;
          return (
            <path
              key={sector.id}
              d={renderedTrackPath}
              pathLength={100}
              className="race-week-sector-track__sector"
              style={
                {
                  "--sector-color": sector.color,
                  strokeDasharray: `${length} ${100 - length}`,
                  strokeDashoffset: -sector.startPercent,
                } as CSSProperties
              }
            />
          );
        })}

        {metadata && showMetadata ? (
          <>
            <g className="race-week-sector-track__start" aria-label="Start finish line">
              <g
                className="race-week-sector-track__start-flag"
                transform={`translate(${metadata.startFinish.x} ${metadata.startFinish.y}) rotate(-7)`}
              >
                <rect x="-10" y="-7" width="20" height="14" />
                <rect className="race-week-sector-track__flag-dark" x="-10" y="-7" width="5" height="7" />
                <rect className="race-week-sector-track__flag-dark" x="0" y="-7" width="5" height="7" />
                <rect className="race-week-sector-track__flag-dark" x="-5" y="0" width="5" height="7" />
                <rect className="race-week-sector-track__flag-dark" x="5" y="0" width="5" height="7" />
              </g>
            </g>

            {metadata.corners.map((marker) => {
              const tooltipWidth = Math.max(72, marker.label.length * 5.7 + 18);
              const tooltip = getTooltipPosition(marker, tooltipWidth);

              return (
                <g
                  className="race-week-sector-track__corner"
                  key={marker.number}
                  tabIndex={0}
                  aria-label={`Turn ${marker.number}: ${marker.label}`}
                >
                  <title>{`Turn ${marker.number}: ${marker.label}`}</title>
                  {marker.anchor ? (
                    <line
                      className="race-week-sector-track__corner-leader"
                      x1={marker.anchor.x}
                      y1={marker.anchor.y}
                      x2={marker.x}
                      y2={marker.y}
                    />
                  ) : null}
                  <circle className="race-week-sector-track__corner-target" cx={marker.x} cy={marker.y} r="12" />
                  <circle cx={marker.x} cy={marker.y} r="8" />
                  <text x={marker.x} y={marker.y + 3}>
                    {marker.number}
                  </text>
                  <g className="race-week-sector-track__corner-tooltip" pointerEvents="none">
                    <rect x={tooltip.x} y={tooltip.y} width={tooltipWidth} height="22" rx="2" />
                    <text x={tooltip.x + 8} y={tooltip.y + 14}>
                      {marker.label}
                    </text>
                  </g>
                </g>
              );
            })}

            {metadata.drsZones.map((callout) => (
              <CircuitCallout key={callout.id} callout={callout} />
            ))}
            {metadata.speedTraps.map((callout) => (
              <CircuitCallout key={callout.id} callout={callout} />
            ))}
          </>
        ) : null}
      </svg>

      {showLegend ? (
        <div className="race-week-sector-track__legend">
          <div className="race-week-sector-track__legend-sectors">
            {sectors.map((sector) => (
              <span key={sector.id}>
                <i style={{ background: sector.color }} />
                {sector.label}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
