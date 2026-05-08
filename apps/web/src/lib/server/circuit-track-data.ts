import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";

export type CircuitTrackData = {
  circuitId: string;
  season: number;
  round: number;
  raceName: string;
  sessionCode: string;
  source: string;
  rotationDegrees: number;
  pathData: string;
};

type CircuitTrackMap = Record<string, CircuitTrackData>;

const circuitTrackPathsFile = path.join(process.cwd(), "..", "..", "data", "race_week", "circuit_track_paths.json");

const loadCircuitTrackData = cache(async (): Promise<CircuitTrackMap> => {
  try {
    const content = await readFile(circuitTrackPathsFile, "utf-8");
    return JSON.parse(content) as CircuitTrackMap;
  } catch {
    return {};
  }
});

export async function getCircuitTrackData(circuitId: string): Promise<CircuitTrackData | null> {
  const trackData = await loadCircuitTrackData();
  return trackData[circuitId] ?? null;
}
