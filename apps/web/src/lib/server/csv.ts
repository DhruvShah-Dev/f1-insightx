import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { parse } from "csv-parse/sync";
import { createAppError } from "@/lib/errors/app-error";

type CsvRow = Record<string, string>;

export const csvFileMap = {
  "analytics.driverComparison": path.join(process.cwd(), "..", "..", "data", "analytics", "analytics_driver_comparison.csv"),
  "analytics.brakingComparison": path.join(process.cwd(), "..", "..", "data", "analytics", "analytics_braking_comparison.csv"),
  "analytics.energyProxyComparison": path.join(process.cwd(), "..", "..", "data", "analytics", "analytics_energy_proxy_comparison.csv"),
  "analytics.sessionIndex": path.join(process.cwd(), "..", "..", "data", "analytics", "analytics_session_index.csv"),
  "analytics.segmentComparison": path.join(process.cwd(), "..", "..", "data", "analytics", "analytics_segment_comparison.csv"),
  "analytics.straightComparison": path.join(process.cwd(), "..", "..", "data", "analytics", "analytics_straight_comparison.csv"),
  "analytics.throttleComparison": path.join(process.cwd(), "..", "..", "data", "analytics", "analytics_throttle_comparison.csv"),
  "analytics.trackSummary": path.join(process.cwd(), "..", "..", "data", "analytics", "analytics_track_summary.csv"),
  "curated.circuits": path.join(process.cwd(), "..", "..", "data", "curated", "circuits.csv"),
  "curated.constructorStandings": path.join(process.cwd(), "..", "..", "data", "curated", "constructor_standings.csv"),
  "curated.constructors": path.join(process.cwd(), "..", "..", "data", "curated", "constructors.csv"),
  "curated.driverStandings": path.join(process.cwd(), "..", "..", "data", "curated", "driver_standings.csv"),
  "curated.drivers": path.join(process.cwd(), "..", "..", "data", "curated", "drivers.csv"),
  "curated.fantasyInputs": path.join(process.cwd(), "..", "..", "data", "curated", "fantasy_inputs.csv"),
  "curated.modelFeatures": path.join(process.cwd(), "..", "..", "data", "curated", "model_features.csv"),
  "curated.predictionSnapshots": path.join(process.cwd(), "..", "..", "data", "curated", "prediction_snapshots.csv"),
  "curated.qualifyingResults": path.join(process.cwd(), "..", "..", "data", "curated", "qualifying_results.csv"),
  "curated.raceResults": path.join(process.cwd(), "..", "..", "data", "curated", "race_results.csv"),
  "curated.raceWeekContext": path.join(process.cwd(), "..", "..", "data", "curated", "race_week_context.csv"),
  "curated.races": path.join(process.cwd(), "..", "..", "data", "curated", "races.csv"),
  "curated.sprintResults": path.join(process.cwd(), "..", "..", "data", "curated", "sprint_results.csv"),
  "curated.strategyProfiles": path.join(process.cwd(), "..", "..", "data", "curated", "strategy_profiles.csv"),
  "raceWeek.constructorBoard": path.join(process.cwd(), "..", "..", "data", "race_week", "race_week_constructor_board.csv"),
  "raceWeek.driverBoard": path.join(process.cwd(), "..", "..", "data", "race_week", "race_week_driver_board.csv"),
  "raceWeek.overview": path.join(process.cwd(), "..", "..", "data", "race_week", "race_week_overview.csv"),
  "raceWeek.storylines": path.join(process.cwd(), "..", "..", "data", "race_week", "race_week_storylines.csv"),
  "raceWeek.strategy": path.join(process.cwd(), "..", "..", "data", "race_week", "race_week_strategy.csv"),
  "strategyLab.comparison": path.join(process.cwd(), "..", "..", "data", "strategy_lab", "strategy_comparison.csv"),
  "strategyLab.constructorProfile": path.join(process.cwd(), "..", "..", "data", "strategy_lab", "constructor_strategy_profile.csv"),
  "strategyLab.driverProfile": path.join(process.cwd(), "..", "..", "data", "strategy_lab", "driver_strategy_profile.csv"),
  "strategyLab.features": path.join(process.cwd(), "..", "..", "data", "strategy_lab", "strategy_features.csv"),
  "strategyLab.overview": path.join(process.cwd(), "..", "..", "data", "strategy_lab", "strategy_lab_overview.csv"),
  "strategyLab.pitWindow": path.join(process.cwd(), "..", "..", "data", "strategy_lab", "pit_window.csv"),
  "strategyLab.projection": path.join(process.cwd(), "..", "..", "data", "strategy_lab", "race_projection.csv"),
} as const;

export type CsvFileKey = keyof typeof csvFileMap;

const missingCsvWarnings = new Set<string>();
const largeCsvWarnings = new Set<string>();
const largeCsvWarningThresholdBytes = 50 * 1024 * 1024;

function getCsvFileUrl(fileKey: string) {
  const fileUrl = csvFileMap[fileKey as CsvFileKey];
  if (!fileUrl) {
    throw createAppError({
      kind: "internal",
      code: "config_error",
      status: 500,
      message: `Unknown CSV file key ${fileKey}.`,
      userMessage: "Requested product data is not configured.",
      details: {
        fileKey,
        knownKeys: Object.keys(csvFileMap),
      },
      exposeDetails: process.env.NODE_ENV !== "production",
    });
  }

  return fileUrl;
}

async function warnIfLarge(fileKey: string, filePath: string) {
  if (largeCsvWarnings.has(fileKey)) {
    return;
  }

  try {
    const info = await stat(filePath);
    if (info.size > largeCsvWarningThresholdBytes) {
      largeCsvWarnings.add(fileKey);
      console.warn(`[data-csv:large] ${fileKey} is ${(info.size / 1024 / 1024).toFixed(1)} MB. Keep runtime payloads scoped.`);
    }
  } catch {
    // Missing-file handling below gives the actionable error.
  }
}

const readCsvRequired = cache(async (fileKey: string) => {
  const fileUrl = getCsvFileUrl(fileKey);
  await warnIfLarge(fileKey, fileUrl);

  try {
    const content = await readFile(fileUrl, "utf-8");
    return parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as CsvRow[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw createAppError({
        kind: "internal",
        code: "service_unavailable",
        status: 503,
        message: `Required dataset ${fileKey} is missing.`,
        userMessage: "Required product data is unavailable right now.",
        details: {
          fileKey,
          path: fileUrl,
        },
        exposeDetails: process.env.NODE_ENV !== "production",
        cause: error,
      });
    }

    throw error;
  }
});

const readCsvOptional = cache(async (fileKey: string) => {
  const fileUrl = getCsvFileUrl(fileKey);
  await warnIfLarge(fileKey, fileUrl);

  try {
    const content = await readFile(fileUrl, "utf-8");
    return parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as CsvRow[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      if (!missingCsvWarnings.has(fileKey)) {
        missingCsvWarnings.add(fileKey);
        console.warn(`[data-csv:missing] ${fileKey} was not found. Falling back to empty data.`);
      }

      return [];
    }

    throw error;
  }
});

export async function readCsvFile<T = CsvRow>(fileKey: CsvFileKey) {
  return readCsvRequired(fileKey) as Promise<T[]>;
}

export async function readOptionalCsvFile<T = CsvRow>(fileKey: CsvFileKey) {
  return readCsvOptional(fileKey) as Promise<T[]>;
}

export function resolveCsvFilePath(fileKey: CsvFileKey) {
  return getCsvFileUrl(fileKey);
}

export function parseNumber(value: string | undefined) {
  if (!value) {
    return null;
  }

  const number = Number(value);
  return Number.isNaN(number) ? null : number;
}

export function parseBoolean(value: string | undefined) {
  return value === "true" || value === "True";
}
