import Image from "next/image";
import { getCircuitGeoFallback } from "@/lib/server/circuit-geojson";
import { getCircuitTrackData } from "@/lib/server/circuit-track-data";
import { getCircuitAsset } from "@/lib/ui/asset-manifest";

type TrackMapProps = {
  circuitId: string;
  title: string;
  variant?: "card" | "hero";
};

export async function TrackMap({ circuitId, title, variant = "card" }: TrackMapProps) {
  const circuit = getCircuitAsset(circuitId);
  const fastf1Track = await getCircuitTrackData(circuitId);
  const geoFallback = await getCircuitGeoFallback(circuitId, variant);
  const className = `track-map track-map--${variant}`;
  const preferredPath = fastf1Track?.pathData ?? geoFallback?.pathData ?? null;

  if (preferredPath) {
    return (
      <div className={className}>
        <div className="track-map__grid" aria-hidden="true" />
        <div className="track-map__glow" aria-hidden="true" />
        <svg
          viewBox="0 0 960 620"
          className="track-map__svg"
          role="img"
          aria-label={`${title} circuit layout`}
          preserveAspectRatio="xMidYMid meet"
        >
          <path d={preferredPath} className="track-map__shadow" />
          <path d={preferredPath} className="track-map__accent" />
          <path d={preferredPath} className="track-map__path" />
        </svg>
      </div>
    );
  }

  if (circuit.layoutAssetPath) {
    return (
      <div className={className}>
        <div className="track-map__grid" aria-hidden="true" />
        <div className="track-map__glow" aria-hidden="true" />
        <Image
          src={circuit.layoutAssetPath}
          alt={`${title} circuit layout`}
          className="track-map__image"
          width={variant === "hero" ? 960 : 420}
          height={variant === "hero" ? 620 : 260}
          sizes={variant === "hero" ? "(max-width: 959px) 100vw, 56rem" : "(max-width: 959px) 100vw, 18rem"}
        />
      </div>
    );
  }

  return (
    <div className={`${className} track-map--fallback`}>
      <div className="track-map__fallback">
        <span>{circuit.countryCode}</span>
        <strong>{title}</strong>
        <p>Track data unavailable for this circuit.</p>
      </div>
    </div>
  );
}
