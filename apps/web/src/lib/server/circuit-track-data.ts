import { readFile } from "node:fs/promises";
import { cache } from "react";
import { readCsvFile } from "@/lib/server/csv";
import { getRepoDataPath } from "@/lib/server/data-paths";

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
type RaceCircuitRow = {
  season: string;
  round: string;
  circuit_id: string;
};

const circuitTrackPathsFile = getRepoDataPath("race_week", "circuit_track_paths.json");

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

const loadRaceCircuitMap = cache(async (): Promise<Map<string, string>> => {
  const rows = await readCsvFile<RaceCircuitRow>("curated.races");
  return new Map(
    rows
      .filter((row) => row.season && row.round && row.circuit_id)
      .map((row) => [`${Number(row.season)}:${Number(row.round)}`, row.circuit_id]),
  );
});

export async function getCircuitTrackDataForRace(season: number, round: number): Promise<CircuitTrackData | null> {
  const raceCircuitMap = await loadRaceCircuitMap();
  const circuitId = raceCircuitMap.get(`${season}:${round}`);
  return circuitId ? getCircuitTrackData(circuitId) : null;
}
