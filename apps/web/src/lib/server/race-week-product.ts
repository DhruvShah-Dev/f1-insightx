import { cache } from "react";
import { readCsvFile } from "@/lib/server/csv";
import { getRuntimeData, resolveRuntimeSource, type RuntimeSourceResult } from "@/lib/server/runtime-source";
import { getSupabasePublicClient } from "@/lib/server/supabase";

export type RaceWeekCanonicalRaceRef = {
  id: string;
  season: number;
  round: number;
  raceName: string;
  circuitId: string;
  circuitName: string;
  circuitCountry: string | null;
  scheduledAt: string;
};

export type RaceWeekProductOverview = {
  currentSeason: number;
  latestCompletedRace: RaceWeekCanonicalRaceRef | null;
  nextRace: RaceWeekCanonicalRaceRef | null;
  archetypeLabel: string | null;
  strategyDifficulty: string | null;
  weatherRiskIndex: number | null;
  rainfallProbability: number | null;
  trackTempMeanC: number | null;
  windSpeedMeanMps: number | null;
  weatherSourceLabel: string | null;
  signalConfidence: number | null;
};

export type RaceWeekQualifyingPrediction = {
  raceId: string;
  predictionMode: RaceWeekPredictionModeId;
  modeLabel: string;
  includedSessions: string[];
  modeStatus: RaceWeekPredictionModeStatus;
  driverId: string;
  constructorId: string;
  predictedQRank: number | null;
  predictedQTimeS: number | null;
  predictedQGapS: number | null;
  basePoleS: number | null;
  seasonDelta26Vs25S: number | null;
  trackResidualS: number | null;
  recentQualiGapS: number | null;
  sameCircuitGapS: number | null;
  constructorQualiGapS: number | null;
  raceWeekDeltaGapS: number | null;
  driverGapDeltaS: number | null;
  constructorGapDeltaS: number | null;
  formBiasScore: number | null;
  confidenceScore: number | null;
  clampedPrediction: boolean;
  missingFlags: string[];
  baselineMethod: string | null;
  sourceLabel: string | null;
};

export type RaceWeekPredictionModeId = "baseline" | "fp1" | "fp2" | "fp3";
export type RaceWeekPredictionModeStatus = "available" | "pending";

export type RaceWeekPredictionMode = {
  id: RaceWeekPredictionModeId;
  label: string;
  status: RaceWeekPredictionModeStatus;
  statusLabel: string;
  includedSessions: string[];
  rowCount: number;
};

export type RaceWeekProduct = {
  overview: RaceWeekProductOverview;
  sessionStatus: Array<{
    sessionCode: "FP1" | "FP2" | "FP3" | "Q";
    status: "complete" | "pending";
    rowCount: number;
  }>;
  driverBoard: Array<{
    driverId: string;
    driverName: string;
    constructorId: string;
    constructorName: string;
    longRunPaceS: number | null;
    gapToLongRunBestS: number | null;
    oneLapPaceS: number | null;
    gapToOneLapBestS: number | null;
    degradationSPerLap: number | null;
    readinessScore: number | null;
    signalConfidence: number | null;
    projectedFinish: number | null;
    summary: string;
  }>;
  constructorBoard: Array<{
    constructorId: string;
    constructorName: string;
    longRunPaceS: number | null;
    oneLapPaceS: number | null;
    degradationIndex: number | null;
    readinessScore: number | null;
    signalConfidence: number | null;
    summary: string;
  }>;
  strategy: Array<{
    driverId: string;
    constructorId: string;
    recommendedStopCount: number | null;
    preferredPrimaryCompound: string | null;
    preferredSecondaryCompound: string | null;
    pitWindowStartLap: number | null;
    pitWindowEndLap: number | null;
    degradationRisk: number | null;
    strategyConfidence: number | null;
    rationale: string;
  }>;
  storylines: Array<{
    entityType: string;
    entityId: string | null;
    storylineType: string;
    priorityRank: number;
    headline: string;
    body: string;
    confidenceBand: string;
    signalConfidence: number | null;
    sourceTitle: string | null;
    sourceUrl: string | null;
    publishedAt: string | null;
  }>;
  predictionModes: RaceWeekPredictionMode[];
  qualifyingPrediction: RaceWeekQualifyingPrediction[];
};

type RaceWeekProductWithRuntime = RaceWeekProduct & {
  runtime?: {
    generatedAt: string | null;
    buildVersion: string | null;
  };
};

export type RaceWeekProductResult = RuntimeSourceResult<RaceWeekProduct>;

type RaceWeekOverviewRow = {
  id: string;
  season: number | string;
  round: number | string;
  race_id: string;
  race_name: string;
  circuit_id: string;
  circuit_name: string;
  scheduled_at: string;
  latest_completed_race_id: string | null;
  archetype_label: string | null;
  strategy_difficulty: string | null;
  weather_risk_index: number | string | null;
  signal_confidence: number | string | null;
  generated_at?: string | null;
  build_version?: string | null;
};

type RaceRow = {
  id: string;
  season: number | string;
  round: number | string;
  race_name: string;
  circuit_id: string;
  scheduled_at: string;
};

type CircuitRow = {
  id: string;
  name: string;
  country: string | null;
};

type DriverBoardRow = {
  race_id?: string;
  driver_id: string;
  driver_name: string;
  constructor_id: string;
  constructor_name: string;
  long_run_pace_s: number | string | null;
  gap_to_long_run_best_s: number | string | null;
  one_lap_pace_s: number | string | null;
  gap_to_one_lap_best_s: number | string | null;
  degradation_s_per_lap: number | string | null;
  readiness_score: number | string | null;
  signal_confidence: number | string | null;
  projected_finish: number | string | null;
  summary: string | null;
};

type ConstructorBoardRow = {
  race_id?: string;
  constructor_id: string;
  constructor_name: string;
  long_run_pace_s: number | string | null;
  one_lap_pace_s: number | string | null;
  degradation_index: number | string | null;
  readiness_score: number | string | null;
  signal_confidence: number | string | null;
  summary: string | null;
};

type StrategyRow = {
  race_id?: string;
  driver_id: string;
  constructor_id: string;
  recommended_stop_count: number | string | null;
  preferred_primary_compound: string | null;
  preferred_secondary_compound: string | null;
  pit_window_start_lap: number | string | null;
  pit_window_end_lap: number | string | null;
  degradation_risk: number | string | null;
  strategy_confidence: number | string | null;
  rationale: string | null;
};

type StorylineRow = {
  race_id?: string;
  entity_type: string;
  entity_id: string | null;
  storyline_type: string;
  priority_rank: number | string;
  headline: string;
  body: string;
  confidence_band: string;
  signal_confidence: number | string | null;
  source_title?: string | null;
  source_url?: string | null;
  published_at?: string | null;
};

type WeatherRiskSummaryRow = {
  race_id: string;
  rainfall_probability: number | string | null;
  track_temp_mean_c: number | string | null;
  wind_speed_mean_mps: number | string | null;
  weather_risk_index: number | string | null;
  source_label?: string | null;
};

type SessionPaceSummaryRow = {
  race_id: string;
  session_code: string;
  driver_id: string;
};

type QualifyingPredictionRow = {
  race_id: string;
  prediction_mode?: string | null;
  mode_label?: string | null;
  included_sessions?: string | null;
  mode_status?: string | null;
  driver_id: string;
  constructor_id: string;
  predicted_q_rank: number | string | null;
  predicted_q_time_s: number | string | null;
  predicted_q_gap_s: number | string | null;
  base_pole_s: number | string | null;
  season_delta_26_vs_25_s: number | string | null;
  track_residual_s: number | string | null;
  recent_quali_gap_s: number | string | null;
  same_circuit_gap_s: number | string | null;
  constructor_quali_gap_s: number | string | null;
  race_week_delta_gap_s: number | string | null;
  driver_gap_delta_s: number | string | null;
  constructor_gap_delta_s: number | string | null;
  form_bias_score: number | string | null;
  confidence_score: number | string | null;
  clamped_prediction: boolean | string | null;
  missing_flags: string | null;
  baseline_method: string | null;
  source_label?: string | null;
};

type RaceRefSource = {
  id?: string;
  race_id?: string;
  season: number | string;
  round: number | string;
  race_name: string;
  circuit_id: string;
  circuit_name?: string | null;
  scheduled_at: string;
};

function parseNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isNaN(number) ? null : number;
}

function parseBoolean(value: boolean | string | null | undefined) {
  if (typeof value === "boolean") {
    return value;
  }
  if (value === null || value === undefined || value === "") {
    return false;
  }
  return ["1", "true", "yes", "y"].includes(value.toLowerCase());
}

function parseFlagList(value: string | null | undefined) {
  if (!value) {
    return [];
  }
  return value
    .split(/[|,;]/)
    .map((flag) => flag.trim())
    .filter(Boolean);
}

function mapRaceRef(row: RaceRefSource, circuit: CircuitRow | null): RaceWeekCanonicalRaceRef {
  const raceId = row.id ?? row.race_id ?? "";
  const circuitName = row.circuit_name ?? undefined;
  return {
    id: raceId,
    season: Number(row.season),
    round: Number(row.round),
    raceName: row.race_name,
    circuitId: row.circuit_id,
    circuitName: circuit?.name ?? circuitName ?? row.circuit_id,
    circuitCountry: circuit?.country ?? null,
    scheduledAt: row.scheduled_at,
  };
}

function attachRaceWeekRuntimeMetadata(
  product: RaceWeekProduct,
  overviewRow: Pick<RaceWeekOverviewRow, "generated_at" | "build_version"> | null,
): RaceWeekProduct {
  return Object.assign(product, {
    runtime: {
      generatedAt: overviewRow?.generated_at ?? null,
      buildVersion: overviewRow?.build_version ?? null,
    },
  }) as RaceWeekProductWithRuntime;
}

function findWeatherSummaryRow(rows: WeatherRiskSummaryRow[], raceId: string, circuitId: string) {
  const exact = rows.find((row) => row.race_id === raceId);
  if (exact) {
    return exact;
  }

  return [...rows]
    .filter((row) => row.race_id?.endsWith(`-${circuitId}`))
    .sort((left, right) => right.race_id.localeCompare(left.race_id))[0] ?? null;
}

function buildSessionStatus(rows: SessionPaceSummaryRow[], raceId: string): RaceWeekProduct["sessionStatus"] {
  return (["FP1", "FP2", "FP3", "Q"] as const).map((sessionCode) => {
    const rowCount = rows.filter((row) => row.race_id === raceId && row.session_code === sessionCode).length;
    return {
      sessionCode,
      status: rowCount > 0 ? "complete" : "pending",
      rowCount,
    };
  });
}

const predictionModeOrder: RaceWeekPredictionModeId[] = ["baseline", "fp1", "fp2", "fp3"];

const predictionModeDefaults: Record<RaceWeekPredictionModeId, { label: string; includedSessions: string[]; statusLabel: string }> = {
  baseline: { label: "Predictions", includedSessions: [], statusLabel: "Using latest available model" },
  fp1: { label: "FP1 pred", includedSessions: ["FP1"], statusLabel: "Using FP1 data" },
  fp2: { label: "FP2 pred", includedSessions: ["FP1", "FP2"], statusLabel: "Using FP1 + FP2 data" },
  fp3: { label: "FP3 pred", includedSessions: ["FP1", "FP2", "FP3"], statusLabel: "Using FP1 + FP2 + FP3 data" },
};

function normalizePredictionMode(value: string | null | undefined): RaceWeekPredictionModeId {
  return predictionModeOrder.includes(value as RaceWeekPredictionModeId) ? (value as RaceWeekPredictionModeId) : "baseline";
}

function parseSessionList(value: string | null | undefined) {
  if (!value) {
    return [];
  }
  return value
    .split(/[|,;]/)
    .map((session) => session.trim().toUpperCase())
    .filter(Boolean);
}

function normalizePredictionModeStatus(value: string | null | undefined): RaceWeekPredictionModeStatus {
  return value === "pending" ? "pending" : "available";
}

function buildPredictionModes(rows: RaceWeekQualifyingPrediction[]): RaceWeekPredictionMode[] {
  return predictionModeOrder.map((id) => {
    const modeRows = rows.filter((row) => row.predictionMode === id);
    const defaultConfig = predictionModeDefaults[id];
    const rowConfig = modeRows[0] ?? null;
    const status: RaceWeekPredictionModeStatus = modeRows.length > 0 ? "available" : "pending";

    let statusLabel = defaultConfig.statusLabel;
    if (status === "pending") {
      statusLabel = `${defaultConfig.label.replace(" pred", "")} data pending`;
    } else if (rowConfig?.includedSessions.length) {
      statusLabel = `Using ${rowConfig.includedSessions.join(" + ")} data`;
    }

    return {
      id,
      label: rowConfig?.modeLabel ?? defaultConfig.label,
      status,
      statusLabel,
      includedSessions: rowConfig?.includedSessions.length ? rowConfig.includedSessions : defaultConfig.includedSessions,
      rowCount: modeRows.length,
    };
  });
}

function mapQualifyingPredictionRows(rows: QualifyingPredictionRow[], raceId: string): RaceWeekQualifyingPrediction[] {
  return rows
    .filter((row) => row && row.race_id === raceId && row.driver_id)
    .map((row) => ({
      raceId: row.race_id,
      predictionMode: normalizePredictionMode(row.prediction_mode),
      modeLabel: row.mode_label ?? predictionModeDefaults[normalizePredictionMode(row.prediction_mode)].label,
      includedSessions: parseSessionList(row.included_sessions),
      modeStatus: normalizePredictionModeStatus(row.mode_status),
      driverId: row.driver_id,
      constructorId: row.constructor_id,
      predictedQRank: parseNumber(row.predicted_q_rank),
      predictedQTimeS: parseNumber(row.predicted_q_time_s),
      predictedQGapS: parseNumber(row.predicted_q_gap_s),
      basePoleS: parseNumber(row.base_pole_s),
      seasonDelta26Vs25S: parseNumber(row.season_delta_26_vs_25_s),
      trackResidualS: parseNumber(row.track_residual_s),
      recentQualiGapS: parseNumber(row.recent_quali_gap_s),
      sameCircuitGapS: parseNumber(row.same_circuit_gap_s),
      constructorQualiGapS: parseNumber(row.constructor_quali_gap_s),
      raceWeekDeltaGapS: parseNumber(row.race_week_delta_gap_s),
      driverGapDeltaS: parseNumber(row.driver_gap_delta_s),
      constructorGapDeltaS: parseNumber(row.constructor_gap_delta_s),
      formBiasScore: parseNumber(row.form_bias_score),
      confidenceScore: parseNumber(row.confidence_score),
      clampedPrediction: parseBoolean(row.clamped_prediction),
      missingFlags: parseFlagList(row.missing_flags),
      baselineMethod: row.baseline_method ?? null,
      sourceLabel: row.source_label ?? null,
    }))
    .sort((left, right) => {
      const leftMode = predictionModeOrder.indexOf(left.predictionMode);
      const rightMode = predictionModeOrder.indexOf(right.predictionMode);
      const leftRank = left.predictedQRank ?? Number.POSITIVE_INFINITY;
      const rightRank = right.predictedQRank ?? Number.POSITIVE_INFINITY;
      return leftMode - rightMode || leftRank - rightRank || (left.predictedQGapS ?? Number.POSITIVE_INFINITY) - (right.predictedQGapS ?? Number.POSITIVE_INFINITY);
    });
}

async function buildProductFromCsv(): Promise<RaceWeekProduct | null> {
  const [overviewRows, driverBoardRows, constructorBoardRows, strategyRows, storylineRows, weatherRows, sessionPaceRows, qualifyingPredictionRows, races, circuits] = await Promise.all([
    readCsvFile<RaceWeekOverviewRow>("raceWeek.overview"),
    readCsvFile<DriverBoardRow>("raceWeek.driverBoard"),
    readCsvFile<ConstructorBoardRow>("raceWeek.constructorBoard"),
    readCsvFile<StrategyRow>("raceWeek.strategy"),
    readCsvFile<StorylineRow>("raceWeek.storylines"),
    readCsvFile<WeatherRiskSummaryRow>("raceWeek.weatherRiskSummary"),
    readCsvFile<SessionPaceSummaryRow>("raceWeek.sessionPaceSummary"),
    readCsvFile<QualifyingPredictionRow>("raceWeek.spainQualifyingPrediction"),
    readCsvFile<RaceRow>("curated.races"),
    readCsvFile<CircuitRow>("curated.circuits"),
  ]);

  const overviewRow = overviewRows
    .sort((left, right) => Number(right.season) - Number(left.season) || Number(right.round) - Number(left.round))[0];
  if (!overviewRow) {
    return null;
  }

  const circuitMap = new Map(circuits.map((circuit) => [circuit.id, circuit]));
  const raceMap = new Map(races.map((race) => [race.id, race]));
  const nextRace = mapRaceRef(overviewRow, circuitMap.get(overviewRow.circuit_id) ?? null);
  const latestCompletedRow = overviewRow.latest_completed_race_id ? raceMap.get(overviewRow.latest_completed_race_id) ?? null : null;
  const latestCompletedRace = latestCompletedRow
    ? mapRaceRef(latestCompletedRow, circuitMap.get(latestCompletedRow.circuit_id) ?? null)
    : null;
  const weatherRow = findWeatherSummaryRow(weatherRows, overviewRow.race_id, overviewRow.circuit_id);
  const sessionStatus = buildSessionStatus(sessionPaceRows, overviewRow.race_id);
  const qualifyingPrediction = mapQualifyingPredictionRows(qualifyingPredictionRows, overviewRow.race_id);

  return attachRaceWeekRuntimeMetadata({
    overview: {
      currentSeason: Number(overviewRow.season),
      latestCompletedRace,
      nextRace,
      archetypeLabel: overviewRow.archetype_label ?? null,
      strategyDifficulty: overviewRow.strategy_difficulty ?? null,
      weatherRiskIndex: parseNumber(overviewRow.weather_risk_index),
      rainfallProbability: parseNumber(weatherRow?.rainfall_probability),
      trackTempMeanC: parseNumber(weatherRow?.track_temp_mean_c),
      windSpeedMeanMps: parseNumber(weatherRow?.wind_speed_mean_mps),
      weatherSourceLabel: weatherRow?.source_label ?? null,
      signalConfidence: parseNumber(overviewRow.signal_confidence),
    },
    sessionStatus,
    driverBoard: driverBoardRows
      .filter((row) => row && row.driver_id && "race_id" in row && row.race_id === overviewRow.race_id)
      .map((row) => ({
        driverId: row.driver_id,
        driverName: row.driver_name,
        constructorId: row.constructor_id,
        constructorName: row.constructor_name,
        longRunPaceS: parseNumber(row.long_run_pace_s),
        gapToLongRunBestS: parseNumber(row.gap_to_long_run_best_s),
        oneLapPaceS: parseNumber(row.one_lap_pace_s),
        gapToOneLapBestS: parseNumber(row.gap_to_one_lap_best_s),
        degradationSPerLap: parseNumber(row.degradation_s_per_lap),
        readinessScore: parseNumber(row.readiness_score),
        signalConfidence: parseNumber(row.signal_confidence),
        projectedFinish: parseNumber(row.projected_finish),
        summary: row.summary ?? "",
      })),
    constructorBoard: constructorBoardRows
      .filter((row) => row && row.constructor_id && "race_id" in row && row.race_id === overviewRow.race_id)
      .map((row) => ({
        constructorId: row.constructor_id,
        constructorName: row.constructor_name,
        longRunPaceS: parseNumber(row.long_run_pace_s),
        oneLapPaceS: parseNumber(row.one_lap_pace_s),
        degradationIndex: parseNumber(row.degradation_index),
        readinessScore: parseNumber(row.readiness_score),
        signalConfidence: parseNumber(row.signal_confidence),
        summary: row.summary ?? "",
      })),
    strategy: strategyRows
      .filter((row) => row && row.driver_id && "race_id" in row && row.race_id === overviewRow.race_id)
      .map((row) => ({
        driverId: row.driver_id,
        constructorId: row.constructor_id,
        recommendedStopCount: parseNumber(row.recommended_stop_count),
        preferredPrimaryCompound: row.preferred_primary_compound ?? null,
        preferredSecondaryCompound: row.preferred_secondary_compound ?? null,
        pitWindowStartLap: parseNumber(row.pit_window_start_lap),
        pitWindowEndLap: parseNumber(row.pit_window_end_lap),
        degradationRisk: parseNumber(row.degradation_risk),
        strategyConfidence: parseNumber(row.strategy_confidence),
        rationale: row.rationale ?? "",
      })),
    storylines: storylineRows
      .filter((row) => row && row.storyline_type && (!("race_id" in row) || row.race_id === overviewRow.race_id))
      .sort((left, right) => Number(left.priority_rank) - Number(right.priority_rank))
      .map((row) => ({
        entityType: row.entity_type,
        entityId: row.entity_id ?? null,
        storylineType: row.storyline_type,
        priorityRank: Number(row.priority_rank),
        headline: row.headline,
        body: row.body,
        confidenceBand: row.confidence_band,
        signalConfidence: parseNumber(row.signal_confidence),
        sourceTitle: row.source_title ?? null,
        sourceUrl: row.source_url ?? null,
        publishedAt: row.published_at ?? null,
      })),
    predictionModes: buildPredictionModes(qualifyingPrediction),
    qualifyingPrediction,
  }, overviewRow);
}

async function buildProductFromSupabase(): Promise<RaceWeekProduct | null> {
  const supabase = getSupabasePublicClient();
  if (!supabase) {
    return null;
  }

  const { data: overviewData, error: overviewError } = await supabase
    .from("race_week_overview_view")
    .select("id, season, round, race_id, race_name, circuit_id, circuit_name, scheduled_at, latest_completed_race_id, archetype_label, strategy_difficulty, weather_risk_index, signal_confidence, generated_at, build_version")
    .order("season", { ascending: false })
    .order("round", { ascending: false })
    .limit(1);

  if (overviewError) {
    throw new Error("Failed to load Race Week overview view.");
  }

  const overviewRow = (overviewData?.[0] ?? null) as RaceWeekOverviewRow | null;
  if (!overviewRow) {
    return null;
  }

  const latestCompletedRaceId = overviewRow.latest_completed_race_id ?? null;

  const [latestRaceResult, driverBoardResult, constructorBoardResult, strategyResult, storylineResult, weatherResult, sessionPaceResult, qualifyingPredictionResult] = await Promise.all([
    latestCompletedRaceId
      ? supabase
          .from("races")
          .select("id, season, round, race_name, circuit_id, scheduled_at")
          .eq("id", latestCompletedRaceId)
          .single<RaceRow>()
      : Promise.resolve({ data: null, error: null }),
    supabase.from("race_week_driver_board_view").select("driver_id, driver_name, constructor_id, constructor_name, long_run_pace_s, gap_to_long_run_best_s, one_lap_pace_s, gap_to_one_lap_best_s, degradation_s_per_lap, readiness_score, signal_confidence, projected_finish, summary").eq("race_id", overviewRow.race_id).order("readiness_score", { ascending: false }),
    supabase.from("race_week_constructor_board_view").select("constructor_id, constructor_name, long_run_pace_s, one_lap_pace_s, degradation_index, readiness_score, signal_confidence, summary").eq("race_id", overviewRow.race_id).order("readiness_score", { ascending: false }),
    supabase.from("race_week_strategy_view").select("driver_id, constructor_id, recommended_stop_count, preferred_primary_compound, preferred_secondary_compound, pit_window_start_lap, pit_window_end_lap, degradation_risk, strategy_confidence, rationale").eq("race_id", overviewRow.race_id),
    supabase.from("race_week_storylines_view").select("entity_type, entity_id, storyline_type, priority_rank, headline, body, confidence_band, signal_confidence, source_title, source_url, published_at").eq("race_id", overviewRow.race_id).order("priority_rank", { ascending: true }),
    supabase.from("weather_risk_summary").select("race_id, rainfall_probability, track_temp_mean_c, wind_speed_mean_mps, weather_risk_index, source_label").eq("race_id", overviewRow.race_id).maybeSingle<WeatherRiskSummaryRow>(),
    supabase.from("session_pace_summary").select("race_id, session_code, driver_id").eq("race_id", overviewRow.race_id).in("session_code", ["FP1", "FP2", "FP3", "Q"]).limit(120),
    supabase
      .from("spain_qualifying_prediction")
      .select("race_id, prediction_mode, mode_label, included_sessions, mode_status, driver_id, constructor_id, predicted_q_rank, predicted_q_time_s, predicted_q_gap_s, base_pole_s, season_delta_26_vs_25_s, track_residual_s, recent_quali_gap_s, same_circuit_gap_s, constructor_quali_gap_s, race_week_delta_gap_s, driver_gap_delta_s, constructor_gap_delta_s, form_bias_score, confidence_score, clamped_prediction, missing_flags, baseline_method, source_label")
      .eq("race_id", overviewRow.race_id)
      .order("prediction_mode", { ascending: true })
      .order("predicted_q_rank", { ascending: true }),
  ]);

  if (
    (latestCompletedRaceId && latestRaceResult.error) ||
    driverBoardResult.error ||
    constructorBoardResult.error ||
    strategyResult.error ||
    storylineResult.error
  ) {
    throw new Error("Failed to load Race Week data.");
  }

  const latestRaceRow = latestRaceResult.data;
  const circuitIds = [overviewRow.circuit_id];
  if (latestRaceRow?.circuit_id) {
    circuitIds.push(latestRaceRow.circuit_id);
  }

  const circuitsResult = await supabase
    .from("circuits")
    .select("id, name, country")
    .in("id", circuitIds);

  if (circuitsResult.error) {
    throw new Error("Failed to load circuit data.");
  }

  const circuitMap = new Map(((circuitsResult.data ?? []) as CircuitRow[]).map((circuit) => [circuit.id, circuit]));
  let latestCompletedRace: RaceWeekCanonicalRaceRef | null = null;
  if (latestRaceRow) {
    latestCompletedRace = mapRaceRef(latestRaceRow, circuitMap.get(latestRaceRow.circuit_id) ?? null);
  }
  const weatherRow = weatherResult.error ? null : weatherResult.data;
  const sessionPaceRows = sessionPaceResult.error ? [] : ((sessionPaceResult.data ?? []) as SessionPaceSummaryRow[]);
  const qualifyingPredictionRows = qualifyingPredictionResult.error ? [] : ((qualifyingPredictionResult.data ?? []) as QualifyingPredictionRow[]);
  const sessionStatus = buildSessionStatus(sessionPaceRows, overviewRow.race_id);
  const qualifyingPrediction = mapQualifyingPredictionRows(qualifyingPredictionRows, overviewRow.race_id);

  return attachRaceWeekRuntimeMetadata({
    overview: {
      currentSeason: Number(overviewRow.season),
      latestCompletedRace,
      nextRace: mapRaceRef(overviewRow, circuitMap.get(overviewRow.circuit_id) ?? null),
      archetypeLabel: overviewRow.archetype_label ?? null,
      strategyDifficulty: overviewRow.strategy_difficulty ?? null,
      weatherRiskIndex: parseNumber(overviewRow.weather_risk_index),
      rainfallProbability: parseNumber(weatherRow?.rainfall_probability),
      trackTempMeanC: parseNumber(weatherRow?.track_temp_mean_c),
      windSpeedMeanMps: parseNumber(weatherRow?.wind_speed_mean_mps),
      weatherSourceLabel: weatherRow?.source_label ?? null,
      signalConfidence: parseNumber(overviewRow.signal_confidence),
    },
    sessionStatus,
    driverBoard: ((driverBoardResult.data ?? []) as DriverBoardRow[]).map((row) => ({
      driverId: row.driver_id,
      driverName: row.driver_name,
      constructorId: row.constructor_id,
      constructorName: row.constructor_name,
      longRunPaceS: parseNumber(row.long_run_pace_s),
      gapToLongRunBestS: parseNumber(row.gap_to_long_run_best_s),
      oneLapPaceS: parseNumber(row.one_lap_pace_s),
      gapToOneLapBestS: parseNumber(row.gap_to_one_lap_best_s),
      degradationSPerLap: parseNumber(row.degradation_s_per_lap),
      readinessScore: parseNumber(row.readiness_score),
      signalConfidence: parseNumber(row.signal_confidence),
      projectedFinish: parseNumber(row.projected_finish),
      summary: row.summary ?? "",
    })),
    constructorBoard: ((constructorBoardResult.data ?? []) as ConstructorBoardRow[]).map((row) => ({
      constructorId: row.constructor_id,
      constructorName: row.constructor_name,
      longRunPaceS: parseNumber(row.long_run_pace_s),
      oneLapPaceS: parseNumber(row.one_lap_pace_s),
      degradationIndex: parseNumber(row.degradation_index),
      readinessScore: parseNumber(row.readiness_score),
      signalConfidence: parseNumber(row.signal_confidence),
      summary: row.summary ?? "",
    })),
    strategy: ((strategyResult.data ?? []) as StrategyRow[]).map((row) => ({
      driverId: row.driver_id,
      constructorId: row.constructor_id,
      recommendedStopCount: parseNumber(row.recommended_stop_count),
      preferredPrimaryCompound: row.preferred_primary_compound ?? null,
      preferredSecondaryCompound: row.preferred_secondary_compound ?? null,
      pitWindowStartLap: parseNumber(row.pit_window_start_lap),
      pitWindowEndLap: parseNumber(row.pit_window_end_lap),
      degradationRisk: parseNumber(row.degradation_risk),
      strategyConfidence: parseNumber(row.strategy_confidence),
      rationale: row.rationale ?? "",
    })),
    storylines: ((storylineResult.data ?? []) as StorylineRow[]).map((row) => ({
      entityType: row.entity_type,
      entityId: row.entity_id ?? null,
      storylineType: row.storyline_type,
      priorityRank: Number(row.priority_rank),
      headline: row.headline,
      body: row.body,
      confidenceBand: row.confidence_band,
      signalConfidence: parseNumber(row.signal_confidence),
      sourceTitle: row.source_title ?? null,
      sourceUrl: row.source_url ?? null,
      publishedAt: row.published_at ?? null,
    })),
    predictionModes: buildPredictionModes(qualifyingPrediction),
    qualifyingPrediction,
  }, overviewRow);
}

function describeRaceWeekProduct(product: RaceWeekProduct) {
  const runtime = (product as RaceWeekProductWithRuntime).runtime;
  return {
    eventId: product.overview.nextRace?.id ?? product.overview.latestCompletedRace?.id ?? null,
    season: product.overview.nextRace?.season ?? product.overview.latestCompletedRace?.season ?? product.overview.currentSeason,
    round: product.overview.nextRace?.round ?? product.overview.latestCompletedRace?.round ?? null,
    generatedAt: runtime?.generatedAt ?? null,
    buildVersion: runtime?.buildVersion ?? null,
  };
}

export const getRaceWeekProductResult = cache(async (): Promise<RaceWeekProductResult> =>
  resolveRuntimeSource({
    surface: "race-week",
    primary: {
      sourceKind: "database",
      sourceLabel: "race_week_views",
      load: async () => {
        const supabase = getSupabasePublicClient();
        if (!supabase) {
          return null;
        }

        return buildProductFromSupabase();
      },
      describe: describeRaceWeekProduct,
    },
    degraded: {
      sourceKind: "csv-product",
      sourceLabel: "race_week_csv",
      load: buildProductFromCsv,
      describe: describeRaceWeekProduct,
    },
  }),
);

export const getRaceWeekProduct = cache(async (): Promise<RaceWeekProduct | null> => {
  const result = await getRaceWeekProductResult();
  return getRuntimeData(result);
});

export const getRaceWeekProductOverview = cache(async (): Promise<RaceWeekProductOverview | null> => {
  const product = await getRaceWeekProduct();
  return product?.overview ?? null;
});
