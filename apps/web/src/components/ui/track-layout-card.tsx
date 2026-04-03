import Image from "next/image";
import { getCircuitAsset } from "@/lib/ui/asset-manifest";

type TrackLayoutCardProps = {
  circuitId: string;
  title?: string;
  compact?: boolean;
  showSource?: boolean;
  showMeta?: boolean;
};

export function TrackLayoutCard({
  circuitId,
  title,
  compact = false,
  showSource = false,
  showMeta = true,
}: TrackLayoutCardProps) {
  const circuit = getCircuitAsset(circuitId);
  const variantClass = compact ? "track-map--card" : "track-map--hero";

  return (
    <div className={`track-layout-card ${compact ? "track-layout-card--compact" : ""}`}>
      <div className="track-layout-card__media">
        <div className={`track-map ${variantClass}`}>
          <div className="track-map__grid" aria-hidden="true" />
          <div className="track-map__glow" aria-hidden="true" />
          {circuit.layoutAssetPath ? (
            <Image
              src={circuit.layoutAssetPath}
              alt={title ?? `${circuit.region} circuit layout`}
              className="track-map__image"
              width={compact ? 420 : 960}
              height={compact ? 260 : 620}
              sizes={compact ? "(max-width: 959px) 100vw, 18rem" : "(max-width: 959px) 100vw, 32rem"}
            />
          ) : (
            <div className="track-map__fallback">
              <span>{circuit.countryCode}</span>
              <strong>{title ?? circuit.region}</strong>
              <p>Layout asset pending</p>
            </div>
          )}
        </div>
      </div>

      {showMeta ? (
        <div className="track-layout-card__meta">
          <span>{circuit.countryCode}</span>
          <strong>{title ?? circuit.region}</strong>
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
