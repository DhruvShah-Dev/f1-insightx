import { getCircuitAsset } from "@/lib/ui/asset-manifest";
import { TrackMap } from "./track-map";

type TrackLayoutCardProps = {
  circuitId: string;
  title?: string;
  compact?: boolean;
  showSource?: boolean;
  showMeta?: boolean;
};

export async function TrackLayoutCard({
  circuitId,
  title,
  compact = false,
  showSource = false,
  showMeta = true,
}: TrackLayoutCardProps) {
  const circuit = getCircuitAsset(circuitId);
  const displayTitle = title ?? circuit.region;

  return (
    <div className={`track-layout-card ${compact ? "track-layout-card--compact" : ""}`}>
      <div className="track-layout-card__media">
        <TrackMap circuitId={circuitId} title={displayTitle} variant={compact ? "card" : "hero"} />
      </div>

      {showMeta ? (
        <div className="track-layout-card__meta">
          <span>{circuit.countryCode}</span>
          <strong>{displayTitle}</strong>
          {showSource && circuit.layoutSourceUrl ? (
            <a
              href={circuit.layoutSourceUrl}
              className="track-layout-card__source"
              target="_blank"
              rel="noreferrer"
            >
              {circuit.layoutSourceLabel}
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
