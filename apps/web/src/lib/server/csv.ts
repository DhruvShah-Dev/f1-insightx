import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { parse } from "csv-parse/sync";
import { getRepoDataPath, getRepoDataRoot, getTestFixturePath, getTestFixtureRoot, isTestRun } from "@/lib/server/data-paths";
import { createAppError } from "@/lib/errors/app-error";

type CsvRow = Record<string, string>;

function getAnalyticsTestFixturePath(csvName: string) {
  return getTestFixturePath("analytics", csvName);
}

export const csvFileMap = {
  "analytics.driverComparison": getRepoDataPath("analytics", "analytics_driver_comparison.csv"),
  "analytics.brakingComparison": getRepoDataPath("analytics", "analytics_braking_comparison.csv"),
  "analytics.energyProxyComparison": getRepoDataPath("analytics", "analytics_energy_proxy_comparison.csv"),
  "analytics.sessionIndex": getRepoDataPath("analytics", "analytics_session_index.csv"),
  "analytics.segmentComparison": getRepoDataPath("analytics", "analytics_segment_comparison.csv"),
  "analytics.straightComparison": getRepoDataPath("analytics", "analytics_straight_comparison.csv"),
  "analytics.throttleComparison": getRepoDataPath("analytics", "analytics_throttle_comparison.csv"),
  "analytics.trackSummary": getRepoDataPath("analytics", "analytics_track_summary.csv"),
  "curated.circuits": getRepoDataPath("curated", "circuits.csv"),
  "curated.constructorStandings": getRepoDataPath("curated", "constructor_standings.csv"),
  "curated.constructors": getRepoDataPath("curated", "constructors.csv"),
  "curated.driverStandings": getRepoDataPath("curated", "driver_standings.csv"),
  "curated.drivers": getRepoDataPath("curated", "drivers.csv"),
  "curated.fantasyInputs": getRepoDataPath("curated", "fantasy_inputs.csv"),
  "curated.modelFeatures": getRepoDataPath("curated", "model_features.csv"),
  "curated.predictionSnapshots": getRepoDataPath("curated", "prediction_snapshots.csv"),
  "curated.qualifyingResults": getRepoDataPath("curated", "qualifying_results.csv"),
  "curated.raceResults": getRepoDataPath("curated", "race_results.csv"),
  "curated.raceWeekContext": getRepoDataPath("curated", "race_week_context.csv"),
  "curated.races": getRepoDataPath("curated", "races.csv"),
  "curated.sprintResults": getRepoDataPath("curated", "sprint_results.csv"),
  "curated.strategyProfiles": getRepoDataPath("curated", "strategy_profiles.csv"),
  "predictions.racePickChallenges": getRepoDataPath("predictions", "race_pick_challenges.csv"),
  "predictions.racePitStopResults": getRepoDataPath("predictions", "race_pit_stop_results.csv"),
  "raceWeek.constructorBoard": getRepoDataPath("race_week", "race_week_constructor_board.csv"),
  "raceWeek.driverBoard": getRepoDataPath("race_week", "race_week_driver_board.csv"),
  "raceWeek.overview": getRepoDataPath("race_week", "race_week_overview.csv"),
  "raceWeek.spainQualifyingPrediction": getRepoDataPath("race_week", "spain_qualifying_prediction.csv"),
  "raceWeek.storylines": getRepoDataPath("race_week", "race_week_storylines.csv"),
  "raceWeek.strategy": getRepoDataPath("race_week", "race_week_strategy.csv"),
  "raceWeek.sessionPaceSummary": getRepoDataPath("race_week", "session_pace_summary.csv"),
  "raceWeek.weatherRiskSummary": getRepoDataPath("race_week", "weather_risk_summary.csv"),
  "raceAnalysis.index": getRepoDataPath("race_analysis", "race_analysis_index.csv"),
  "raceAnalysis.links": getRepoDataPath("race_analysis", "race_analysis_links.csv"),
  "raceAnalysis.neutralizationPhases": getRepoDataPath("race_analysis", "race_analysis_neutralization_phases.csv"),
  "raceAnalysis.paceEvolution": getRepoDataPath("race_analysis", "race_analysis_pace_evolution.csv"),
  "raceAnalysis.pitStrategy": getRepoDataPath("race_analysis", "race_analysis_pit_strategy.csv"),
  "raceAnalysis.positionChanges": getRepoDataPath("race_analysis", "race_analysis_position_changes.csv"),
  "raceAnalysis.positionSwingEvents": getRepoDataPath("race_analysis", "race_analysis_position_swing_events.csv"),
  "raceAnalysis.positionTimeline": getRepoDataPath("race_analysis", "race_analysis_position_timeline.csv"),
  "raceAnalysis.stints": getRepoDataPath("race_analysis", "race_analysis_stints.csv"),
  "raceAnalysis.storyPoints": getRepoDataPath("race_analysis", "race_analysis_story_points.csv"),
  "raceAnalysis.summary": getRepoDataPath("race_analysis", "race_analysis_summary.csv"),
  "raceAnalysis.trackStatus": getRepoDataPath("race_analysis", "race_analysis_track_status.csv"),
  "raceAnalysis.trafficProxy": getRepoDataPath("race_analysis", "race_analysis_traffic_proxy.csv"),
  "raceAnalysis.weatherContext": getRepoDataPath("race_analysis", "race_analysis_weather_context.csv"),
  "strategyLab.comparison": getRepoDataPath("strategy_lab", "strategy_comparison.csv"),
  "strategyLab.constructorProfile": getRepoDataPath("strategy_lab", "constructor_strategy_profile.csv"),
  "strategyLab.driverProfile": getRepoDataPath("strategy_lab", "driver_strategy_profile.csv"),
  "strategyLab.features": getRepoDataPath("strategy_lab", "strategy_features.csv"),
  "strategyLab.overview": getRepoDataPath("strategy_lab", "strategy_lab_overview.csv"),
  "strategyLab.pitWindow": getRepoDataPath("strategy_lab", "pit_window.csv"),
  "strategyLab.projection": getRepoDataPath("strategy_lab", "race_projection.csv"),
} as const;

export type CsvFileKey = keyof typeof csvFileMap;

const missingCsvWarnings = new Set<string>();
const largeCsvWarnings = new Set<string>();
const largeCsvWarningThresholdBytes = 50 * 1024 * 1024;

function getCsvFileUrl(fileKey: string) {
  if (isTestRun() && fileKey === "analytics.sessionIndex") {
    return getAnalyticsTestFixturePath("analytics_session_index.csv");
  }

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

  if (isTestRun()) {
    const repoDataRoot = getRepoDataRoot();
    const relativeFixturePath = path.relative(repoDataRoot, fileUrl);
    const fixtureUrl = path.join(getTestFixtureRoot(), relativeFixturePath);
    if (!relativeFixturePath.startsWith("..") && !path.isAbsolute(relativeFixturePath) && existsSync(fixtureUrl)) {
      return fixtureUrl;
    }
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
