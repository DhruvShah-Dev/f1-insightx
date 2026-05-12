import { cache } from "react";
import { readFile } from "node:fs/promises";
import path from "node:path";

export type SeasonRaceRef = {
  id: string | null;
  season: number | null;
  round: number | null;
  race_name: string | null;
  circuit_id: string | null;
  scheduled_at: string | null;
  status: string | null;
};

export type SeasonState = {
  schema_version: number;
  season: number | null;
  latest_completed_race: SeasonRaceRef | null;
  latest_completed_race_with_results: SeasonRaceRef | null;
  latest_completed_race_with_telemetry: SeasonRaceRef | null;
  latest_completed_race_with_analytics: SeasonRaceRef | null;
  next_race: SeasonRaceRef | null;
  current_race_week: {
    race: SeasonRaceRef | null;
    product_view_race: SeasonRaceRef | null;
    available: boolean;
  };
  telemetry_available: {
    available: boolean;
    latest_race: SeasonRaceRef | null;
  };
  analytics_available: {
    available: boolean;
    latest_race: SeasonRaceRef | null;
  };
  strategy_lab_available: {
    available: boolean;
    latest_race: SeasonRaceRef | null;
    next_race_available: boolean;
  };
  race_analysis_available: {
    available: boolean;
    latest_race: SeasonRaceRef | null;
    reason: string | null;
  };
  freshness: Record<string, {
    generated_at: string | null;
    build_version: string | null;
    validation_status: string | null;
    warnings: string[];
  }>;
  missing_data_flags: string[];
  warnings: string[];
  data_gaps: Record<string, string>;
  generated_at: string;
  build_version: string;
};

const seasonStatePath = path.join(process.cwd(), "..", "..", "data", "season_state.json");

export const getSeasonState = cache(async (): Promise<SeasonState | null> => {
  try {
    const content = await readFile(seasonStatePath, "utf-8");
    return JSON.parse(content) as SeasonState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      console.warn("[season-state:missing] data/season_state.json is unavailable.");
      return null;
    }
    throw error;
  }
});

export function formatSeasonRaceLabel(race: SeasonRaceRef | null | undefined) {
  if (!race?.race_name) {
    return "Unavailable";
  }
  return race.round ? `${race.race_name} R${race.round}` : race.race_name;
}

export function getSeasonStateWarning(state: SeasonState | null, flag: string) {
  if (!state?.missing_data_flags.includes(flag)) {
    return null;
  }
  return state.warnings.find((warning) => warning.toLowerCase().includes(flag.split("_")[0])) ?? state.warnings[0] ?? null;
}
