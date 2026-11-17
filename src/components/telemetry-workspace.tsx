import { useMemo, useState, type PointerEvent as ReactPointerEvent } from "react";
import { RotateCcw } from "lucide-react";
import type {
  TelemetryComparison,
  TelemetryPoint,
  TelemetrySegment,
  TelemetryStraight,
  TelemetryTrace,
} from "@/lib/telemetry-comparison";
import { fmtNum } from "@/lib/format";
import "./telemetry-workspace.css";

export type WorkspacePanel = "overview" | "telemetry" | "segments" | "race";
export type TelemetryChannel = "speed" | "inputs" | "gear" | "rpm" | "drs" | "energy";

const PANELS: { id: WorkspacePanel; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "telemetry", label: "Telemetry" },
  { id: "segments", label: "Segments" },
  { id: "race", label: "Race" },
];
const CHANNELS: { id: TelemetryChannel; label: string; unit: string }[] = [
  { id: "speed", label: "Speed", unit: "km/h" },
  { id: "inputs", label: "Throttle / brake", unit: "%" },
  { id: "gear", label: "Gear", unit: "gear" },
  { id: "rpm", label: "RPM", unit: "rpm" },
  { id: "drs", label: "DRS", unit: "state" },
  { id: "energy", label: "Energy proxy", unit: "index" },
];

function pointValue(point: TelemetryPoint, channel: TelemetryChannel) {
  if (channel === "speed") return point.speed;
  if (channel === "inputs") return point.throttle;
  if (channel === "gear") return point.gear;
  if (channel === "rpm") return point.rpm;
  if (channel === "drs") return point.drs;
  return point.energyProxy;
}

function formatValue(value: number | null, channel: TelemetryChannel) {
  if (value == null) return "—";
  if (channel === "speed") return `${fmtNum(value, 1)} km/h`;
  if (channel === "inputs") return `${fmtNum(value, 0)}%`;
  if (channel === "gear") return `G${fmtNum(value, 0)}`;
  if (channel === "rpm") return `${fmtNum(value, 0)} rpm`;
  if (channel === "drs") return value > 0 ? "Open" : "Closed";
  return fmtNum(value, 3);
}

function pathFor(
  points: TelemetryPoint[],
  channel: TelemetryChannel,
  min: number,
  max: number,
  range: [number, number],
) {
  const width = 920;
  const height = 238;
  const span = Math.max(0.0001, range[1] - range[0]);
  const ySpan = Math.max(0.0001, max - min);
  return points
    .map((point, index) => {
      const value = pointValue(point, channel);
      if (value == null) return "";
      const x = 54 + ((point.x - range[0]) / span) * width;
      const y = 32 + height - ((value - min) / ySpan) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .filter(Boolean)
    .join(" ");
}

function closestPoint(trace: TelemetryTrace | null, x: number) {
  if (!trace?.points.length) return null;
  let closest = trace.points[0] ?? null;
  let distance = Number.POSITIVE_INFINITY;
  for (const point of trace.points) {
    const nextDistance = Math.abs(point.x - x);
    if (nextDistance < distance) {
      closest = point;
      distance = nextDistance;
    }
  }
  return closest;
}

export function TelemetryWorkspaceNav({
  panel,
  onChange,
  raceAvailable,
}: {
  panel: WorkspacePanel;
  onChange: (panel: WorkspacePanel) => void;
  raceAvailable: boolean;
}) {
  return (
    <nav className="tw-panel-nav" aria-label="Comparison workspace">
      {PANELS.map((item) => (
        <button
          key={item.id}
          type="button"
          disabled={item.id === "race" && !raceAvailable}
          aria-current={panel === item.id ? "page" : undefined}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}

function TraceHeader({ trace, color }: { trace: TelemetryTrace | null; color: string }) {
  return (
    <div className="tw-trace-meta" style={{ borderColor: color }}>
      <strong style={{ color }}>{trace?.driver ?? "—"}</strong>
      <span>{trace?.lapKind ?? "Representative trace unavailable"}</span>
      <small>
        {trace?.lapNumber ? `Lap ${trace.lapNumber}` : "No lap"}
        {trace?.compound ? ` · ${trace.compound}` : ""}
        {trace?.quality != null ? ` · ${fmtNum(trace.quality * 100, 0)}% quality` : ""}
      </small>
    </div>
  );
}

function TelemetryChart({
  data,
  channel,
  range,
  selectedSegment,
  colorA,
  colorB,
}: {
  data: TelemetryComparison;
  channel: TelemetryChannel;
  range: [number, number];
  selectedSegment: string | null;
  colorA: string;
  colorB: string;
}) {
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [pinnedX, setPinnedX] = useState<number | null>(null);
  const focusX = pinnedX ?? hoverX ?? (range[0] + range[1]) / 2;
  const [traceA, traceB] = data.traces;
  const visibleA = useMemo(
    () => traceA?.points.filter((point) => point.x >= range[0] && point.x <= range[1]) ?? [],
    [traceA, range],
  );
  const visibleB = useMemo(
    () => traceB?.points.filter((point) => point.x >= range[0] && point.x <= range[1]) ?? [],
    [traceB, range],
  );
  const domain = useMemo(() => {
    const values = [...visibleA, ...visibleB]
      .map((point) => pointValue(point, channel))
      .filter((value): value is number => value != null && Number.isFinite(value));
    if (channel === "inputs") return [0, 100] as const;
    if (channel === "gear") return [0, 8] as const;
    if (channel === "drs" || channel === "energy") return [0, 1] as const;
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 1);
    const padding = Math.max(1, (max - min) * 0.08);
    return [Math.max(0, min - padding), max + padding] as const;
  }, [visibleA, visibleB, channel]);
  const selected = data.segments.find((segment) => segment.segmentId === selectedSegment) ?? null;
  const pointA = closestPoint(traceA, focusX);
  const pointB = closestPoint(traceB, focusX);
  const xPixel = 54 + ((focusX - range[0]) / Math.max(0.0001, range[1] - range[0])) * 920;
  const distance = Math.max(traceA?.distanceM ?? 0, traceB?.distanceM ?? 0);

  const moveFocus = (event: ReactPointerEvent<SVGRectElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    setHoverX(range[0] + fraction * (range[1] - range[0]));
  };
  const step = (direction: number) => {
    const points = traceA?.points ?? traceB?.points ?? [];
    if (!points.length) return;
    const current = closestPoint(traceA ?? traceB, focusX);
    const currentIndex = Math.max(0, points.indexOf(current ?? points[0]!));
    setPinnedX(points[Math.max(0, Math.min(points.length - 1, currentIndex + direction))]?.x ?? focusX);
  };

  return (
    <div className="tw-chart-shell">
      <div className="tw-trace-ledger">
        <TraceHeader trace={traceA} color={colorA} />
        <TraceHeader trace={traceB} color={colorB} />
      </div>
      <div className="tw-chart-scroll">
        <svg
          className="tw-chart"
          viewBox="0 0 1000 330"
          role="group"
          aria-label={`${CHANNELS.find((item) => item.id === channel)?.label} comparison over normalized lap distance`}
        >
          <title>{CHANNELS.find((item) => item.id === channel)?.label} telemetry comparison</title>
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
            <g key={tick}>
              <line x1={54} x2={974} y1={32 + tick * 238} y2={32 + tick * 238} className="tw-grid" />
              <text x={46} y={37 + tick * 238} textAnchor="end" className="tw-axis-label">
                {fmtNum(domain[1] - tick * (domain[1] - domain[0]), channel === "energy" ? 2 : 0)}
              </text>
            </g>
          ))}
          {(channel === "inputs" ? [...(traceA?.spans.braking ?? []), ...(traceB?.spans.braking ?? [])] : channel === "drs" ? [...(traceA?.spans.drs ?? []), ...(traceB?.spans.drs ?? [])] : []).map((span, index) => {
            const start = Math.max(span.start, range[0]);
            const end = Math.min(span.end, range[1]);
            if (end <= start) return null;
            return (
              <rect
                key={`${span.start}-${index}`}
                x={54 + ((start - range[0]) / (range[1] - range[0])) * 920}
                y={32}
                width={((end - start) / (range[1] - range[0])) * 920}
                height={238}
                className={channel === "drs" ? "tw-drs-band" : "tw-brake-band"}
              />
            );
          })}
          {selected ? (
            <rect
              x={54 + ((Math.max(selected.normalizedStart, range[0]) - range[0]) / (range[1] - range[0])) * 920}
              y={26}
              width={(Math.max(0, Math.min(selected.normalizedEnd, range[1]) - Math.max(selected.normalizedStart, range[0])) / (range[1] - range[0])) * 920}
              height={250}
              className="tw-segment-band"
            />
          ) : null}
          <path d={pathFor(visibleA, channel, domain[0], domain[1], range)} fill="none" stroke={colorA} className="tw-line" />
          <path d={pathFor(visibleB, channel, domain[0], domain[1], range)} fill="none" stroke={colorB} className="tw-line tw-line-b" />
          <line x1={xPixel} x2={xPixel} y1={24} y2={280} className="tw-crosshair" />
          <circle cx={xPixel} cy={286} r={4} className={pinnedX == null ? "tw-focus-dot" : "tw-focus-dot is-pinned"} />
          {[range[0], (range[0] + range[1]) / 2, range[1]].map((tick) => (
            <text key={tick} x={54 + ((tick - range[0]) / (range[1] - range[0])) * 920} y={310} textAnchor="middle" className="tw-axis-label">
              {distance ? `${fmtNum(tick * distance, 0)} m` : `${fmtNum(tick * 100, 0)}%`}
            </text>
          ))}
          <rect
            x={54}
            y={18}
            width={920}
            height={274}
            fill="transparent"
            tabIndex={0}
            role="slider"
            aria-label="Telemetry distance focus"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(focusX * 100)}
            onPointerMove={moveFocus}
            onPointerLeave={() => setHoverX(null)}
            onClick={() => setPinnedX(pinnedX == null ? focusX : null)}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault();
                step(event.key === "ArrowLeft" ? -1 : 1);
              }
              if (event.key === "Escape") setPinnedX(null);
            }}
          />
        </svg>
      </div>
      <div className="tw-inspector" aria-live="polite">
        <div>
          <span>Focus</span>
          <strong>{distance ? `${fmtNum(focusX * distance, 0)} m` : `${fmtNum(focusX * 100, 1)}% lap`}</strong>
          <small>{pinnedX == null ? "Move or tap to inspect · click to pin" : "Pinned · click chart or press Esc to release"}</small>
        </div>
        {[{ code: data.drivers.a, point: pointA, color: colorA }, { code: data.drivers.b, point: pointB, color: colorB }].map((item) => (
          <div key={item.code} style={{ borderTopColor: item.color }}>
            <span>{item.code}</span>
            <strong>{formatValue(item.point ? pointValue(item.point, channel) : null, channel)}</strong>
            <small>
              G{fmtNum(item.point?.gear, 0)} · throttle {fmtNum(item.point?.throttle, 0)}% · brake {fmtNum(item.point?.brake, 0)}% · DRS {item.point?.drs ? "open" : "closed"}
            </small>
          </div>
        ))}
      </div>
    </div>
  );
}

function Overview({ data, colorA, colorB }: { data: TelemetryComparison; colorA: string; colorB: string }) {
  const overview = data.overview;
  const signals = [
    { label: "Corner zones", a: overview?.segmentWinsA ?? 0, b: overview?.segmentWinsB ?? 0, suffix: "" },
    { label: "Straight zones", a: overview?.straightWinsA ?? 0, b: overview?.straightWinsB ?? 0, suffix: "" },
    { label: "Avg corner delta", a: overview?.avgSegmentDeltaKph ?? null, b: overview?.avgSegmentDeltaKph == null ? null : -overview.avgSegmentDeltaKph, suffix: " km/h" },
    { label: "Avg straight delta", a: overview?.avgStraightDeltaKph ?? null, b: overview?.avgStraightDeltaKph == null ? null : -overview.avgStraightDeltaKph, suffix: " km/h" },
  ];
  return (
    <section className="tw-overview">
      <div className="tw-insight">
        <p>Prepared telemetry read</p>
        <h2>{overview?.strategyNote ?? "Use the available traces and segment evidence to compare the selected drivers."}</h2>
        <span>{data.quality.label} · {data.track?.archetype ?? "mixed circuit"}</span>
      </div>
      <div className="tw-signal-list">
        {signals.map((signal) => (
          <div key={signal.label}>
            <strong style={{ color: colorA }}>{signal.a == null ? "—" : `${fmtNum(signal.a, signal.suffix ? 2 : 0)}${signal.suffix}`}</strong>
            <span>{signal.label}</span>
            <strong style={{ color: colorB }}>{signal.b == null ? "—" : `${fmtNum(signal.b, signal.suffix ? 2 : 0)}${signal.suffix}`}</strong>
          </div>
        ))}
      </div>
      <div className="tw-quality-strip">
        <span>Confidence {data.quality.confidence == null ? "—" : `${fmtNum(data.quality.confidence * 100, 0)}%`}</span>
        <span>Trace quality {data.quality.traceQuality == null ? "—" : `${fmtNum(data.quality.traceQuality * 100, 0)}%`}</span>
        <span>{data.track?.archetype ?? "Track archetype unavailable"}</span>
      </div>
    </section>
  );
}

function signed(value: number | null, suffix = "") {
  if (value == null) return "—";
  return `${value > 0 ? "+" : ""}${fmtNum(value, 2)}${suffix}`;
}

function SegmentWorkspace({
  data,
  selectedSegment,
  onSelect,
  colorA,
  colorB,
}: {
  data: TelemetryComparison;
  selectedSegment: string | null;
  onSelect: (segment: string | null) => void;
  colorA: string;
  colorB: string;
}) {
  const [mode, setMode] = useState<"corners" | "straights">("corners");
  const rows: Array<TelemetrySegment | TelemetryStraight> = mode === "corners" ? data.segments : data.straights;
  const selected = rows.find((row) => row.segmentId === selectedSegment) ?? rows[0] ?? null;
  if (!rows.length) return <div className="tw-empty">No {mode} analytics are available for this driver pair.</div>;
  return (
    <section className="tw-segments">
      <div className="tw-segment-modes" role="tablist" aria-label="Segment type">
        <button type="button" role="tab" aria-selected={mode === "corners"} onClick={() => setMode("corners")}>Corners</button>
        <button type="button" role="tab" aria-selected={mode === "straights"} onClick={() => setMode("straights")}>Straights</button>
      </div>
      <div className="tw-segment-layout">
        <div className="tw-segment-rail" aria-label={`Available ${mode}`}>
          {rows.map((row) => (
            <button
              key={row.segmentId}
              type="button"
              aria-pressed={selected?.segmentId === row.segmentId}
              onClick={() => onSelect(row.segmentId)}
            >
              <strong>{row.label}</strong>
              <span>{fmtNum((row.confidence ?? 0) * 100, 0)}%</span>
            </button>
          ))}
        </div>
        {selected && "apexDeltaKph" in selected ? (
          <div className="tw-segment-detail">
            <header>
              <div><span>Approximate corner zone</span><h2>{selected.label}</h2></div>
              <strong style={{ color: selected.fasterDriver === data.drivers.b ? colorB : colorA }}>{selected.fasterDriver ?? "Even"}</strong>
            </header>
            <div className="tw-phase-grid">
              {[
                ["Entry", selected.entryDeltaKph, selected.entrySpeedA, selected.entrySpeedB, selected.entryGearA, selected.entryGearB],
                ["Apex", selected.apexDeltaKph, selected.apexSpeedA, selected.apexSpeedB, selected.apexGearA, selected.apexGearB],
                ["Exit", selected.exitDeltaKph, selected.exitSpeedA, selected.exitSpeedB, selected.exitGearA, selected.exitGearB],
              ].map(([label, delta, speedA, speedB, gearA, gearB]) => (
                <div key={String(label)}>
                  <span>{label}</span><strong>{signed(delta as number | null, " km/h")}</strong>
                  <small>{data.drivers.a} {fmtNum(speedA as number | null, 1)} / G{fmtNum(gearA as number | null, 0)} · {data.drivers.b} {fmtNum(speedB as number | null, 1)} / G{fmtNum(gearB as number | null, 0)}</small>
                </div>
              ))}
            </div>
            <div className="tw-engineering-strip">
              <span>Brake point <strong>{signed(selected.brakingStartDeltaM, " m")}</strong></span>
              <span>Brake duration <strong>{signed(selected.brakingDurationDeltaS, " s")}</strong></span>
              <span>Throttle pickup <strong>{signed(selected.throttlePickupDeltaM, " m")}</strong></span>
              <span>Traction <strong>{signed(selected.tractionDelta)}</strong></span>
            </div>
          </div>
        ) : selected && "terminalSpeedDeltaKph" in selected ? (
          <div className="tw-segment-detail">
            <header>
              <div><span>Approximate straight zone</span><h2>{selected.label}</h2></div>
              <strong style={{ color: selected.favorableDriver === data.drivers.b ? colorB : colorA }}>{selected.favorableDriver ?? "Even"}</strong>
            </header>
            <div className="tw-phase-grid">
              <div><span>Entry speed delta</span><strong>{signed(selected.entrySpeedDeltaKph, " km/h")}</strong></div>
              <div><span>Terminal speed delta</span><strong>{signed(selected.terminalSpeedDeltaKph, " km/h")}</strong></div>
              <div><span>Acceleration delta</span><strong>{signed(selected.accelerationDelta)}</strong></div>
            </div>
            <div className="tw-engineering-strip">
              <span>DRS use delta <strong>{signed(selected.drsActiveDeltaPct, "%")}</strong></span>
              <span>Clipping proxy <strong>{signed(selected.clippingProxyDelta)}</strong></span>
              <span>Deployment proxy <strong>{signed(selected.deploymentProxyDelta)}</strong></span>
              <span>Recovery proxy <strong>{signed(selected.recoveryZoneDelta)}</strong></span>
            </div>
            <p className="tw-proxy-note">{data.proxyNote}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function TelemetryWorkspace({
  data,
  panel,
  channel,
  range,
  selectedSegment,
  colorA,
  colorB,
  onChannelChange,
  onRangeChange,
  onSegmentChange,
}: {
  data: TelemetryComparison;
  panel: Exclude<WorkspacePanel, "race">;
  channel: TelemetryChannel;
  range: [number, number];
  selectedSegment: string | null;
  colorA: string;
  colorB: string;
  onChannelChange: (channel: TelemetryChannel) => void;
  onRangeChange: (range: [number, number]) => void;
  onSegmentChange: (segment: string | null) => void;
}) {
  if (data.availability === "unavailable" || data.availability === "results-only") {
    return <div className="tw-empty"><strong>Telemetry unavailable</strong><span>{data.note}</span></div>;
  }
  if (panel === "overview") return <Overview data={data} colorA={colorA} colorB={colorB} />;
  if (panel === "segments") return <SegmentWorkspace data={data} selectedSegment={selectedSegment} onSelect={onSegmentChange} colorA={colorA} colorB={colorB} />;
  return (
    <section className="tw-workspace">
      <header className="tw-workspace-header">
        <div>
          <p>{data.session.code} · representative lap telemetry</p>
          <h2>Synchronized telemetry</h2>
          <span>{data.quality.label} · {data.note}</span>
        </div>
        <div className="tw-channel-rail" role="tablist" aria-label="Telemetry channel">
          {CHANNELS.map((item) => (
            <button key={item.id} type="button" role="tab" aria-selected={channel === item.id} onClick={() => onChannelChange(item.id)}>{item.label}</button>
          ))}
        </div>
      </header>
      <TelemetryChart data={data} channel={channel} range={range} selectedSegment={selectedSegment} colorA={colorA} colorB={colorB} />
      <div className="tw-range-controls">
        <label>Start <input type="range" min={0} max={95} value={Math.round(range[0] * 100)} onChange={(event) => onRangeChange([Math.min(Number(event.target.value) / 100, range[1] - 0.05), range[1]])} /></label>
        <label>End <input type="range" min={5} max={100} value={Math.round(range[1] * 100)} onChange={(event) => onRangeChange([range[0], Math.max(Number(event.target.value) / 100, range[0] + 0.05)])} /></label>
        <button type="button" onClick={() => onRangeChange([0, 1])}><RotateCcw size={14} /> Reset range</button>
      </div>
      <div className="tw-segment-links" role="group" aria-label="Approximate segment focus">
        {data.segments.map((segment) => (
          <button key={segment.segmentId} type="button" aria-pressed={selectedSegment === segment.segmentId} onClick={() => onSegmentChange(selectedSegment === segment.segmentId ? null : segment.segmentId)}>{segment.label}</button>
        ))}
      </div>
      <p className="tw-proxy-note">Approximate telemetry-derived zones. {data.proxyNote}</p>
    </section>
  );
}
