import trackPathsRaw from "../../data/race_week/circuit_track_paths.json?raw";

export type LocalTrackPath = {
  circuitId: string;
  pathData: string;
  rotation: number;
  source: string | null;
  sourceSeason: number | null;
};

type TrackPathArtifact = {
  circuitId?: string;
  pathData?: string;
  rotationDegrees?: number;
  source?: string;
  season?: number;
};

const trackPaths = JSON.parse(trackPathsRaw) as Record<string, TrackPathArtifact>;

export function localTrackPathForCircuit(circuitId?: string | null): LocalTrackPath | null {
  if (!circuitId) return null;
  const artifact = trackPaths[circuitId];
  if (!artifact?.pathData) return null;
  return {
    circuitId: artifact.circuitId ?? circuitId,
    pathData: artifact.pathData,
    rotation: Number(artifact.rotationDegrees ?? 0),
    source: artifact.source ?? null,
    sourceSeason: artifact.season ?? null,
  };
}
