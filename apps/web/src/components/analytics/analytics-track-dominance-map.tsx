import type { CircuitTrackData } from "@/lib/server/circuit-track-data";

export type AnalyticsDominanceSegment = {
  segmentId: string;
  label: string;
  kind: string;
  leader: string;
  value: number;
  confidence: number | null;
};

type TrackPoint = {
  x: number;
  y: number;
};

type TrackMarker = TrackPoint & {
  segment: AnalyticsDominanceSegment;
  index: number;
};

type TrackSlice = {
  segment: AnalyticsDominanceSegment;
  pathData: string;
};

type AnalyticsTrackDominanceMapProps = {
  trackData: CircuitTrackData | null;
  segments: AnalyticsDominanceSegment[];
  driverA: string;
  driverB: string;
  title: string;
};

type AnalyticsMiniTrackMapProps = AnalyticsTrackDominanceMapProps & {
  className?: string;
};

const markerLimit = 10;
const pathCoordinatePattern = /[ML]\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g;

function parseTrackPoints(pathData: string): TrackPoint[] {
  const points: TrackPoint[] = [];
  for (const match of pathData.matchAll(pathCoordinatePattern)) {
    points.push({ x: Number(match[1]), y: Number(match[2]) });
  }
  return points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

function getTrackViewBox(points: TrackPoint[]) {
  if (points.length === 0) {
    return "0 0 960 620";
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const pad = Math.max(width, height) * 0.08;
  return `${(minX - pad).toFixed(1)} ${(minY - pad).toFixed(1)} ${(width + pad * 2).toFixed(1)} ${(height + pad * 2).toFixed(1)}`;
}

function distanceBetween(left: TrackPoint, right: TrackPoint) {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

function closeLoop(points: TrackPoint[]) {
  if (points.length < 2) {
    return points;
  }

  const first = points[0];
  const last = points[points.length - 1];
  return distanceBetween(first, last) > 0.01 ? [...points, first] : points;
}

function pointAtDistance(points: TrackPoint[], targetDistance: number): TrackPoint {
  const loop = closeLoop(points);
  let covered = 0;

  for (let index = 1; index < loop.length; index += 1) {
    const previous = loop[index - 1];
    const current = loop[index];
    const segmentDistance = distanceBetween(previous, current);
    if (covered + segmentDistance >= targetDistance) {
      const ratio = segmentDistance === 0 ? 0 : (targetDistance - covered) / segmentDistance;
      return {
        x: previous.x + (current.x - previous.x) * ratio,
        y: previous.y + (current.y - previous.y) * ratio,
      };
    }
    covered += segmentDistance;
  }

  return loop.at(-1) ?? { x: 0, y: 0 };
}

function buildMarkers(points: TrackPoint[], segments: AnalyticsDominanceSegment[]): TrackMarker[] {
  const loop = closeLoop(points);
  if (loop.length < 2 || segments.length === 0) {
    return [];
  }

  const totalDistance = trackDistance(loop);
  const visibleSegments = segments.slice(0, markerLimit);

  return visibleSegments.map((segment, index) => ({
    ...pointAtDistance(loop, totalDistance * ((index + 0.5) / visibleSegments.length)),
    segment,
    index: index + 1,
  }));
}

function trackDistance(points: TrackPoint[]) {
  return points.slice(1).reduce((sum, point, index) => sum + distanceBetween(points[index], point), 0);
}

function pathFromPoints(points: TrackPoint[]) {
  if (points.length === 0) {
    return "";
  }

  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
}

function buildDominanceSlices(points: TrackPoint[], segments: AnalyticsDominanceSegment[]): TrackSlice[] {
  const loop = closeLoop(points);
  if (loop.length < 2 || segments.length === 0) {
    return [];
  }

  const visibleSegments = segments.slice(0, markerLimit);
  const totalDistance = trackDistance(loop);
  const sampleCount = 14;

  return visibleSegments.map((segment, index) => {
    const start = totalDistance * (index / visibleSegments.length);
    const end = totalDistance * ((index + 1) / visibleSegments.length);
    const samples = Array.from({ length: sampleCount }, (_, sampleIndex) => {
      const ratio = sampleIndex / (sampleCount - 1);
      return pointAtDistance(loop, start + (end - start) * ratio);
    });

    return {
      segment,
      pathData: pathFromPoints(samples),
    };
  });
}

function ownerClass(segment: AnalyticsDominanceSegment, driverA: string, driverB: string) {
  if (segment.leader === driverA) return "analytics-track-map__marker--a";
  if (segment.leader === driverB) return "analytics-track-map__marker--b";
  return "analytics-track-map__marker--even";
}

export function AnalyticsTrackDominanceMap({
  trackData,
  segments,
  driverA,
  driverB,
  title,
}: AnalyticsTrackDominanceMapProps) {
  const points = trackData ? parseTrackPoints(trackData.pathData) : [];
  const viewBox = getTrackViewBox(points);
  const markers = buildMarkers(points, segments);
  const slices = buildDominanceSlices(points, segments);
  const hasTrackGeometry = Boolean(trackData?.pathData && points.length > 2);

  return (
    <section className="analytics-page__dominance-map" aria-label="Track dominance map">
      <div className="analytics-page__section-header">
        <span>Track dominance map</span>
        <h2>{hasTrackGeometry ? "Real circuit geometry." : "Circuit map unavailable."}</h2>
      </div>
      <div className="analytics-page__map-grid">
        <div className="analytics-track-map">
          {hasTrackGeometry ? (
            <svg
              className="analytics-track-map__svg"
              viewBox={viewBox}
              role="img"
              aria-label={`${title} real circuit outline with approximate telemetry dominance markers for ${driverA} versus ${driverB}`}
              preserveAspectRatio="xMidYMid meet"
            >
              <path d={trackData?.pathData} className="analytics-track-map__shadow" />
              <path d={trackData?.pathData} className="analytics-track-map__base" />
              {slices.map((slice) => (
                <path
                  key={`slice-${slice.segment.segmentId}`}
                  d={slice.pathData}
                  className={`analytics-track-map__slice ${ownerClass(slice.segment, driverA, driverB)}`}
                  data-sync-id={slice.segment.segmentId}
                />
              ))}
              <path d={trackData?.pathData} className="analytics-track-map__line" />
              {markers.map((marker) => (
                <g
                  key={`${marker.segment.segmentId}-${marker.index}`}
                  className={`analytics-track-map__marker ${ownerClass(marker.segment, driverA, driverB)}`}
                  transform={`translate(${marker.x.toFixed(2)} ${marker.y.toFixed(2)})`}
                  data-sync-id={marker.segment.segmentId}
                  tabIndex={0}
                  aria-label={`${marker.segment.label}, ${marker.segment.kind}, ${marker.segment.leader} leads`}
                >
                  <circle r="13" />
                  <text x="0" y="4" textAnchor="middle">{marker.index}</text>
                </g>
              ))}
            </svg>
          ) : (
            <div className="analytics-track-map__unavailable">
              <span>Circuit map unavailable</span>
              <strong>{title}</strong>
              <p>Segment dominance remains available in the list.</p>
            </div>
          )}
          <div className="analytics-track-map__caption">
            <span>{hasTrackGeometry ? "FastF1-derived path" : "Circuit map unavailable"}</span>
            <strong>Segment markers</strong>
          </div>
        </div>
        <div className="analytics-page__dominance-board">
          <div className="analytics-page__dominance-legend">
            <span><i className="analytics-page__legend-a" />{driverA}</span>
            <span><i className="analytics-page__legend-b" />{driverB}</span>
            <span><i />Even</span>
          </div>
          <div className="analytics-page__dominance-list">
            {segments.slice(0, 6).map((segment, index) => {
              const rowClass = segment.leader === driverA ? "analytics-page__dominance-row--a" : segment.leader === driverB ? "analytics-page__dominance-row--b" : "analytics-page__dominance-row--even";
              return (
                <div className={`analytics-page__dominance-row ${rowClass}`} key={segment.segmentId} data-sync-id={segment.segmentId} tabIndex={0}>
                  <span>{index + 1}. {segment.label}</span>
                  <strong>{segment.leader}</strong>
                  <em>{segment.kind}</em>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export function AnalyticsMiniTrackMap({
  trackData,
  segments,
  driverA,
  driverB,
  title,
  className,
}: AnalyticsMiniTrackMapProps) {
  const points = trackData ? parseTrackPoints(trackData.pathData) : [];
  const viewBox = getTrackViewBox(points);
  const slices = buildDominanceSlices(points, segments);
  const hasTrackGeometry = Boolean(trackData?.pathData && points.length > 2);

  return (
    <div className={`analytics-mini-track${className ? ` ${className}` : ""}`}>
      {hasTrackGeometry ? (
        <svg
          viewBox={viewBox}
          className="analytics-mini-track__svg"
          role="img"
          aria-label={`${title} compact track dominance map for ${driverA} versus ${driverB}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <path d={trackData?.pathData} className="analytics-mini-track__shadow" />
          <path d={trackData?.pathData} className="analytics-mini-track__base" />
          {slices.map((slice) => (
            <path
              key={`mini-slice-${slice.segment.segmentId}`}
              d={slice.pathData}
              className={`analytics-mini-track__slice ${ownerClass(slice.segment, driverA, driverB)}`}
            />
          ))}
          <path d={trackData?.pathData} className="analytics-mini-track__line" />
        </svg>
      ) : (
        <div className="analytics-mini-track__empty">Circuit map unavailable</div>
      )}
    </div>
  );
}
