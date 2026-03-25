import Image from "next/image";
import { getCircuitGeoFallback } from "@/lib/server/circuit-geojson";
import { getCircuitAsset } from "@/lib/ui/asset-manifest";

type TrackMapProps = {
  circuitId: string;
  title: string;
  variant?: "card" | "hero";
};

export async function TrackMap({ circuitId, title, variant = "card" }: TrackMapProps) {
  const circuit = getCircuitAsset(circuitId);
  const geoFallback = await getCircuitGeoFallback(circuitId, variant);
  const className = `track-map track-map--${variant}`;
  const preferGeometry = variant === "card";

  if (preferGeometry && geoFallback?.pathData) {
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
          <path d={geoFallback.pathData} className="track-map__shadow" />
          <path d={geoFallback.pathData} className="track-map__accent" />
          <path d={geoFallback.pathData} className="track-map__path" />
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

  if (geoFallback?.pathData) {
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
          <path d={geoFallback.pathData} className="track-map__shadow" />
          <path d={geoFallback.pathData} className="track-map__accent" />
          <path d={geoFallback.pathData} className="track-map__path" />
        </svg>
      </div>
    );
  }

  return (
    <div className={`${className} track-map--fallback`}>
      <div className="track-map__fallback">
        <span>{circuit.countryCode}</span>
        <strong>{title}</strong>
        <p>Track visual unavailable</p>
      </div>
    </div>
  );
}
