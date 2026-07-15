import { readFile } from "node:fs/promises";
import { cache } from "react";
import { readCsvFile } from "@/lib/server/csv";
import { getRepoDataPath, isTestRun } from "@/lib/server/data-paths";

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

type SupabaseCircuitTrackRow = {
  circuit_id: string;
  season: number | string | null;
  round: number | string | null;
  race_name: string | null;
  session_code: string | null;
  source: string | null;
  rotation_degrees: number | string | null;
  path_data: string | null;
};

const circuitTrackPathsFile = getRepoDataPath("race_week", "circuit_track_paths.json");

function mapSupabaseCircuitTrackRow(row: SupabaseCircuitTrackRow): CircuitTrackData | null {
  if (!row.circuit_id || !row.path_data) {
    return null;
  }

  return {
    circuitId: row.circuit_id,
    season: Number(row.season ?? 0),
    round: Number(row.round ?? 0),
    raceName: row.race_name ?? row.circuit_id,
    sessionCode: row.session_code ?? "",
    source: row.source ?? "supabase",
    rotationDegrees: Number(row.rotation_degrees ?? 0),
    pathData: row.path_data,
  };
}

async function loadCircuitTrackDataFromSupabase(): Promise<CircuitTrackMap | null> {
  const supabase = isTestRun()
    ? null
    : (await import("@/lib/server/supabase")).getSupabasePublicClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("circuit_track_paths")
    .select("circuit_id, season, round, race_name, session_code, source, rotation_degrees, path_data");

  if (error || !data?.length) {
    return null;
  }

  return Object.fromEntries(
    (data as SupabaseCircuitTrackRow[])
      .map(mapSupabaseCircuitTrackRow)
      .filter((row): row is CircuitTrackData => row !== null)
      .map((row) => [row.circuitId, row]),
  );
}

const loadCircuitTrackData = cache(async (): Promise<CircuitTrackMap> => {
  const supabaseData = await loadCircuitTrackDataFromSupabase();
  if (supabaseData && Object.keys(supabaseData).length > 0) {
    return supabaseData;
  }

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
