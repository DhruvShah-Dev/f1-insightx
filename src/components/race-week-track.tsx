import { useMemo, useState } from "react";
import type { TrackPath } from "@/lib/f1.functions";
import type { TrackReference } from "@/data/race-week-reference";

type Point = { x: number; y: number };

function pathModel(path: TrackPath | null) {
  if (!path?.pathData) return null;
  const values = path.pathData.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (values.length < 16) return null;
  const points: Point[] = [];
  for (let i = 0; i + 1 < values.length; i += 2) points.push({ x: values[i]!, y: values[i + 1]! });
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    lengths.push(lengths[i - 1]! + Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y));
  }
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  const rotate = (degrees: number) => {
    const angle = degrees * Math.PI / 180;
    return points.map((point) => ({
      x: center.x + (point.x - center.x) * Math.cos(angle) - (point.y - center.y) * Math.sin(angle),
      y: center.y + (point.x - center.x) * Math.sin(angle) + (point.y - center.y) * Math.cos(angle),
    }));
  };
  let rotation = path.rotation;
  let rotated = rotate(rotation);
  if (Math.max(...rotated.map((point) => point.y)) - Math.min(...rotated.map((point) => point.y)) > Math.max(...rotated.map((point) => point.x)) - Math.min(...rotated.map((point) => point.x))) {
    rotation -= 90;
    rotated = rotate(rotation);
  }
  const xs = rotated.map((point) => point.x);
  const ys = rotated.map((point) => point.y);
  const pad = Math.max(maxX - minX, maxY - minY) * 0.12;
  const viewBox = `${Math.min(...xs) - pad} ${Math.min(...ys) - pad} ${Math.max(...xs) - Math.min(...xs) + pad * 2} ${Math.max(...ys) - Math.min(...ys) + pad * 2}`;
  const pointAt = (fraction: number) => {
    const target = lengths.at(-1)! * fraction;
    const index = Math.max(1, lengths.findIndex((length) => length >= target));
    const from = points[index - 1]!;
    const to = points[index] ?? from;
    const segment = lengths[index]! - lengths[index - 1]!;
    const ratio = segment ? (target - lengths[index - 1]!) / segment : 0;
    return { x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio };
  };
  return { viewBox, center, pointAt, rotation };
}

export function RaceWeekTrack({ path, reference, name, lengthKm }: { path: TrackPath | null; reference: TrackReference | null; name: string; lengthKm: number | null }) {
  const model = useMemo(() => pathModel(path), [path]);
  const [selected, setSelected] = useState<string | null>(null);
  const markers = reference?.annotations.filter((annotation) => annotation.placement !== "reference_only") ?? [];
  const referenceOnly = reference?.annotations.filter((annotation) => annotation.placement === "reference_only") ?? [];
  const selectedMarker = markers.find((marker) => marker.id === selected);

  return <div className="rw-track-layout">
    <div className="rw-track-visual">
      {model && path ? <svg viewBox={model.viewBox} role="img" aria-label={`${name} track outline with approximate positions of sourced circuit markers`}>
        <g transform={`rotate(${model.rotation} ${model.center.x} ${model.center.y})`}>
          <path className="rw-track-shadow" d={path.pathData} />
          <path className="rw-track-line" d={path.pathData} />
          {markers.map((marker) => {
            const point = model.pointAt(marker.distanceM == null || !reference ? 0 : marker.distanceM / (reference.lapKm * 1000));
            const ahead = model.pointAt(marker.distanceM == null || !reference ? 0.003 : Math.min(0.999, marker.distanceM / (reference.lapKm * 1000) + 0.003));
            const tangentLength = Math.hypot(ahead.x - point.x, ahead.y - point.y) || 1;
            const normal = { x: (point.y - ahead.y) / tangentLength, y: (ahead.x - point.x) / tangentLength };
            return <g key={marker.id} className={selected === marker.id ? "rw-marker rw-marker-active" : "rw-marker"}>
              {marker.kind === "start_finish" ? <line x1={point.x - normal.x * 15} y1={point.y - normal.y * 15} x2={point.x + normal.x * 15} y2={point.y + normal.y * 15} /> : null}
              <circle cx={point.x} cy={point.y} r={selected === marker.id ? 13 : 9} />
            </g>;
          })}
        </g>
      </svg> : <p className="rw-empty">Track outline pending verified geometry.</p>}
      {model && markers.length ? <span className="rw-track-note">Marker positions on the lap trace are approximate</span> : null}
    </div>
    <div className="rw-track-detail">
      <p className="rw-overline">Circuit map</p>
      <h3>{name}</h3>
      {reference ? <div className="rw-track-numbers">
        <div><strong>{reference.lapKm.toFixed(3)}</strong><span>km per lap</span></div>
        <div><strong>{reference.turns}</strong><span>turns</span></div>
        <div><strong>{reference.laps}</strong><span>race laps</span></div>
      </div> : lengthKm != null ? <p className="rw-track-length">{lengthKm.toFixed(3)} km per lap</p> : null}
      <p className="rw-detail-intro">{reference ? "The official 2026 circuit reference confirms the markers below. Sector boundaries and pit access are omitted until their positions can be aligned to this path." : "Exact circuit annotations are pending a verified event reference."}</p>
      {markers.length ? <div className="rw-annotation-list" aria-label="Track markers">
        {markers.map((marker) => <button key={marker.id} type="button" aria-pressed={selected === marker.id} onClick={() => setSelected(marker.id)}>
          <span>{marker.label}</span><strong>{marker.distanceM === 0 ? "0 m" : `${marker.distanceM?.toLocaleString()} m`}</strong>
        </button>)}
      </div> : <p className="rw-empty">Exact circuit markers pending source verification.</p>}
      {referenceOnly.length ? <div className="rw-reference-only"><span>Also marked on the official map</span><p>{referenceOnly.map((annotation) => annotation.label).join(" · ")}</p><small>Positions not yet aligned to this lap trace</small></div> : null}
      {selectedMarker ? <p className="rw-selected-marker">{selectedMarker.label} at lap distance {selectedMarker.distanceM?.toLocaleString()} m.</p> : null}
      {reference ? <p className="rw-source"><a href={reference.sourceUrl} target="_blank" rel="noopener noreferrer">2026 FIA circuit reference ↗</a> · <a href={reference.distanceSourceUrl} target="_blank" rel="noopener noreferrer">Race distance ↗</a></p> : null}
    </div>
  </div>;
}
