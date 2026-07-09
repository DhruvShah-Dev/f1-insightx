import Image from "next/image";
import { RaceWeekCircuitVisualization } from "@/components/race-week/race-week-circuit-visualization";
import { getCircuitGeoFallback } from "@/lib/server/circuit-geojson";
import { getCircuitTrackData } from "@/lib/server/circuit-track-data";
import { getCircuitAsset } from "@/lib/ui/asset-manifest";
import { getRaceWeekCircuitMetadata } from "@/lib/ui/race-week-circuit-metadata";

type TrackMapProps = {
  circuitId: string;
  title: string;
  variant?: "card" | "hero";
  presentation?: "detailed" | "hero";
};

function isUsablePath(pathData: string | null | undefined) {
  const normalized = pathData?.trim();
  return Boolean(normalized && normalized.length > 16 && /[MLCQ]/i.test(normalized));
}

export async function TrackMap({ circuitId, title, variant = "card", presentation = "detailed" }: TrackMapProps) {
  const circuit = getCircuitAsset(circuitId);
  const fastf1Track = await getCircuitTrackData(circuitId);
  const geoFallback = await getCircuitGeoFallback(circuitId, variant);
  const className = `track-map track-map--${variant}`;
  const preferredPath = isUsablePath(fastf1Track?.pathData)
    ? fastf1Track?.pathData
    : isUsablePath(geoFallback?.pathData)
      ? geoFallback?.pathData
      : null;

  if (preferredPath) {
    return (
      <div className={`${className} track-map--premium`}>
        <div className="track-map__grid" aria-hidden="true" />
        <div className="track-map__glow" aria-hidden="true" />
        <RaceWeekCircuitVisualization
          title={title}
          trackPath={preferredPath}
          metadata={isUsablePath(fastf1Track?.pathData) ? getRaceWeekCircuitMetadata(circuitId) : null}
          presentation={presentation}
          showLegend={variant === "hero"}
          showMetadata={variant === "hero"}
        />
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
