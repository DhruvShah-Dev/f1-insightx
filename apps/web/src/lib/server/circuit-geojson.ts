import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { getCircuitAsset } from "@/lib/ui/asset-manifest";

type GeoJsonFeature = {
  type: "Feature";
  properties: {
    id: string;
    Name: string;
    Location: string;
    opened?: number;
    firstgp?: number;
    length?: number;
    altitude?: number;
  };
  geometry: {
    type: "LineString" | "MultiLineString";
    coordinates: number[][] | number[][][];
  };
};

type GeoJsonCollection = {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
};

export type CircuitGeoFallback = {
  name: string;
  firstGrandPrix: number | null;
  lengthKm: number | null;
  altitudeM: number | null;
  pathData: string | null;
};

type ProjectionVariant = "card" | "hero";

const loadCircuitGeoJson = cache(async (): Promise<GeoJsonCollection> => {
  const filePath = path.join(process.cwd(), "public", "assets", "circuits", "f1-circuits.geojson");
  const content = await readFile(filePath, "utf-8");
  return JSON.parse(content) as GeoJsonCollection;
});

export async function getCircuitGeoFallback(
  circuitId: string,
  variant: ProjectionVariant = "card",
): Promise<CircuitGeoFallback | null> {
  const circuit = getCircuitAsset(circuitId);
  if (!circuit.geoJsonFeatureId) {
    return null;
  }

  const featureCollection = await loadCircuitGeoJson();
  const feature = featureCollection.features.find(
    (item) => item.properties.id === circuit.geoJsonFeatureId,
  );

  if (!feature) {
    return null;
  }

  return {
    name: feature.properties.Name,
    firstGrandPrix: feature.properties.firstgp ?? null,
    lengthKm:
      typeof feature.properties.length === "number"
        ? Number((feature.properties.length / 1000).toFixed(3))
        : null,
    altitudeM: feature.properties.altitude ?? null,
    pathData: projectFeatureToPath(feature.geometry.coordinates, variant),
  };
}

function projectFeatureToPath(
  coordinates: number[][] | number[][][],
  variant: ProjectionVariant,
): string | null {
  const segments = normalizeSegments(coordinates);
  if (segments.length === 0) {
    return null;
  }

  const points = segments.flat();
  const longitudes = points.map(([longitude]) => longitude);
  const latitudes = points.map(([, latitude]) => latitude);
  const minX = Math.min(...longitudes);
  const maxX = Math.max(...longitudes);
  const minY = Math.min(...latitudes);
  const maxY = Math.max(...latitudes);
  const width = maxX - minX || 1;
  const height = maxY - minY || 1;
  const viewWidth = 960;
  const viewHeight = 620;
  const paddingX = variant === "hero" ? 48 : 26;
  const paddingY = variant === "hero" ? 44 : 22;
  const usableWidth = viewWidth - paddingX * 2;
  const usableHeight = viewHeight - paddingY * 2;
  const scale = Math.min(usableWidth / width, usableHeight / height);
  const fittedWidth = width * scale;
  const fittedHeight = height * scale;
  const offsetX = (viewWidth - fittedWidth) / 2;
  const offsetY = (viewHeight - fittedHeight) / 2;

  const projectPoint = ([longitude, latitude]: number[]) => {
    const x = offsetX + (longitude - minX) * scale;
    const y = viewHeight - offsetY - (latitude - minY) * scale;
    return `${x.toFixed(2)} ${y.toFixed(2)}`;
  };

  return segments
    .map((segment) => {
      const [first, ...rest] = segment;
      return [`M ${projectPoint(first)}`, ...rest.map((point) => `L ${projectPoint(point)}`)].join(" ");
    })
    .join(" ");
}

function normalizeSegments(coordinates: number[][] | number[][][]) {
  if (coordinates.length === 0) {
    return [];
  }

  const first = coordinates[0];
  if (Array.isArray(first[0])) {
    return coordinates as number[][][];
  }

  return [coordinates as number[][]];
}
