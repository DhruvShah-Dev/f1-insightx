import { cache } from "react";
import { readCuratedCsv, readDataCsv } from "@/lib/server/csv";
import { getSupabaseAdminClient } from "@/lib/server/supabase";
import type { Race } from "@/lib/server/reference-data";

type Numeric = number | string | null | undefined;

type StrategyLabOverviewRow = {
  race_id: string;
  race_name: string;
  circuit_id: string;
  archetype_label: string | null;
  race_difficulty: string | null;
  nominal_race_laps: Numeric;
  pit_loss_estimate_s: Numeric;
  best_strategy_code: string | null;
  best_strategy_label: string | null;
  key_insight: string | null;
  confidence_score: Numeric;
};

type StrategyFeatureRow = {
  race_id: string;
  driver_id: string;
  constructor_id: string;
  nominal_race_laps: Numeric;
  base_race_pace_s: Numeric;
  base_quali_pace_s: Numeric;
  pace_evolution_s_per_lap: Numeric;
  pit_loss_s: Numeric;
  baseline_stop_count: Numeric;
  baseline_strategy_code: string | null;
  baseline_pit_window_start_lap: Numeric;
  baseline_pit_window_end_lap: Numeric;
  compound_delta_soft_s: Numeric;
  compound_delta_medium_s: Numeric;
  compound_delta_hard_s: Numeric;
  degradation_soft_s_per_lap: Numeric;
  degradation_medium_s_per_lap: Numeric;
  degradation_hard_s_per_lap: Numeric;
  stint_length_soft_laps: Numeric;
  stint_length_medium_laps: Numeric;
  stint_length_hard_laps: Numeric;
};

type DriverStrategyProfileRow = {
  race_id: string;
  driver_id: string;
  constructor_id: string;
  aggressive_tendency_score: Numeric;
  tyre_management_score: Numeric;
  early_pit_bias_score: Numeric;
  late_pit_bias_score: Numeric;
  racecraft_proxy_score: Numeric;
  confidence_score: Numeric;
};

type ConstructorStrategyProfileRow = {
  race_id: string;
  constructor_id: string;
  pit_efficiency_score: Numeric;
  pit_loss_adjustment_s: Numeric;
  strategy_success_proxy: Numeric;
  double_stack_risk_score: Numeric;
  confidence_score: Numeric;
};

type StrategyComparisonRow = {
  race_id: string;
  driver_id: string;
  constructor_id: string;
  scenario_code: string;
  scenario_label: string;
  pit_stop_count: Numeric;
  compound_sequence: string;
  total_race_time_s: Numeric;
  delta_vs_baseline_s: Numeric;
  average_stint_degradation_s: Numeric;
  estimated_finish_position: Numeric;
  estimated_finish_band_low: Numeric;
  estimated_finish_band_high: Numeric;
  confidence_score: Numeric;
  recommendation_rank: Numeric;
  rationale: string | null;
};

type PitWindowRow = {
  race_id: string;
  driver_id: string;
  constructor_id: string;
  scenario_code: string;
  stop_number: Numeric;
  window_start_lap: Numeric;
  window_end_lap: Numeric;
  compound_in: string | null;
  compound_out: string | null;
};

type RaceProjectionRow = {
  race_id: string;
  driver_id: string;
  constructor_id: string;
  baseline_strategy_code: string | null;
  baseline_total_time_s: Numeric;
  projected_finish: Numeric;
  finish_band_low: Numeric;
  finish_band_high: Numeric;
  win_probability: Numeric;
  podium_probability: Numeric;
  confidence_score: Numeric;
};

type RaceRow = {
  id: string;
  season: number | string;
  round: number | string;
  race_name: string;
  official_name: string | null;
  circuit_id: string;
  scheduled_at: string;
  sprint_weekend: boolean | string | null;
};

type DriverRow = { id: string; full_name: string };
type ConstructorRow = { id: string; name: string };
type CircuitRow = { id: string; name: string; country: string | null };

export type StrategyLabRaceProduct = {
  race: Race & { circuitName: string; circuitCountry: string | null };
  overview: {
    archetypeLabel: string | null;
    raceDifficulty: string | null;
    nominalRaceLaps: number | null;
    pitLossEstimateS: number | null;
    bestStrategyCode: string | null;
    bestStrategyLabel: string | null;
    keyInsight: string;
    confidenceScore: number | null;
  };
  entrants: Array<{
    driverId: string;
    fullName: string;
    constructorId: string;
    constructorName: string;
    projectedFinish: number | null;
    finishBandLow: number | null;
    finishBandHigh: number | null;
    podiumProbability: number | null;
    winProbability: number | null;
    baselineStrategyCode: string | null;
    baselineTotalTimeS: number | null;
    confidenceScore: number | null;
    strategyFeature: {
      nominalRaceLaps: number | null;
      baseRacePaceS: number | null;
      baseQualiPaceS: number | null;
      paceEvolutionSPerLap: number | null;
      pitLossS: number | null;
      baselineStopCount: number | null;
      baselinePitWindowStartLap: number | null;
      baselinePitWindowEndLap: number | null;
      compoundProfiles: {
        soft: { deltaS: number | null; degradationSPerLap: number | null; maxStintLaps: number | null };
        medium: { deltaS: number | null; degradationSPerLap: number | null; maxStintLaps: number | null };
        hard: { deltaS: number | null; degradationSPerLap: number | null; maxStintLaps: number | null };
      };
    };
    driverProfile: {
      aggressiveTendencyScore: number | null;
      tyreManagementScore: number | null;
      earlyPitBiasScore: number | null;
      latePitBiasScore: number | null;
      racecraftProxyScore: number | null;
      confidenceScore: number | null;
    };
    constructorProfile: {
      pitEfficiencyScore: number | null;
      pitLossAdjustmentS: number | null;
      strategySuccessProxy: number | null;
      doubleStackRiskScore: number | null;
      confidenceScore: number | null;
    };
    scenarios: Array<{
      scenarioCode: string;
      scenarioLabel: string;
      pitStopCount: number | null;
      compoundSequence: string;
      totalRaceTimeS: number | null;
      deltaVsBaselineS: number | null;
      averageStintDegradationS: number | null;
      estimatedFinishPosition: number | null;
      estimatedFinishBandLow: number | null;
      estimatedFinishBandHigh: number | null;
      confidenceScore: number | null;
      recommendationRank: number | null;
      rationale: string;
    }>;
    pitWindows: Array<{
      scenarioCode: string;
      stopNumber: number | null;
      windowStartLap: number | null;
      windowEndLap: number | null;
      compoundIn: string | null;
      compoundOut: string | null;
    }>;
  }>;
};

function parseNumber(value: Numeric) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseBoolean(value: boolean | string | null | undefined) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return value === "true" || value === "True";
  }
  return false;
}

function buildProductFromRows({
  raceId,
  overviewRows,
  featureRows,
  driverProfileRows,
  constructorProfileRows,
  comparisonRows,
  pitRows,
  projectionRows,
  races,
  drivers,
  constructors,
  circuits,
}: {
  raceId: string;
  overviewRows: StrategyLabOverviewRow[];
  featureRows: StrategyFeatureRow[];
  driverProfileRows: DriverStrategyProfileRow[];
  constructorProfileRows: ConstructorStrategyProfileRow[];
  comparisonRows: StrategyComparisonRow[];
  pitRows: PitWindowRow[];
  projectionRows: RaceProjectionRow[];
  races: RaceRow[];
  drivers: DriverRow[];
  constructors: ConstructorRow[];
  circuits: CircuitRow[];
}): StrategyLabRaceProduct | null {
  const overviewRow = overviewRows.find((row) => row.race_id === raceId);
  const raceRow = races.find((row) => row.id === raceId);
  if (!overviewRow || !raceRow) return null;

  const driverMap = new Map(drivers.map((row) => [row.id, row.full_name]));
  const constructorMap = new Map(constructors.map((row) => [row.id, row.name]));
  const circuitMap = new Map(circuits.map((row) => [row.id, row]));
  const driverProfilesByDriver = new Map(
    driverProfileRows.filter((row) => row.race_id === raceId).map((row) => [row.driver_id, row]),
  );
  const constructorProfilesByConstructor = new Map(
    constructorProfileRows.filter((row) => row.race_id === raceId).map((row) => [row.constructor_id, row]),
  );
  const projectionsByDriver = new Map(
    projectionRows.filter((row) => row.race_id === raceId).map((row) => [row.driver_id, row]),
  );
  const comparisonsByDriver = new Map<string, StrategyComparisonRow[]>();
  const pitWindowsByDriver = new Map<string, PitWindowRow[]>();
  const circuit = circuitMap.get(raceRow.circuit_id) ?? null;

  for (const row of comparisonRows) {
    if (row.race_id !== raceId) continue;
    const list = comparisonsByDriver.get(row.driver_id) ?? [];
    list.push(row);
    comparisonsByDriver.set(row.driver_id, list);
  }

  for (const row of pitRows) {
    if (row.race_id !== raceId) continue;
    const list = pitWindowsByDriver.get(row.driver_id) ?? [];
    list.push(row);
    pitWindowsByDriver.set(row.driver_id, list);
  }

  const entrants = featureRows
    .filter((row) => row.race_id === raceId)
    .map((featureRow) => {
      const driverProfile = driverProfilesByDriver.get(featureRow.driver_id);
      const constructorProfile = constructorProfilesByConstructor.get(featureRow.constructor_id);
      const projection = projectionsByDriver.get(featureRow.driver_id);
      const scenarios = (comparisonsByDriver.get(featureRow.driver_id) ?? [])
        .sort((a, b) => (parseNumber(a.recommendation_rank) ?? 99) - (parseNumber(b.recommendation_rank) ?? 99))
        .map((row) => ({
          scenarioCode: row.scenario_code,
          scenarioLabel: row.scenario_label,
          pitStopCount: parseNumber(row.pit_stop_count),
          compoundSequence: row.compound_sequence,
          totalRaceTimeS: parseNumber(row.total_race_time_s),
          deltaVsBaselineS: parseNumber(row.delta_vs_baseline_s),
          averageStintDegradationS: parseNumber(row.average_stint_degradation_s),
          estimatedFinishPosition: parseNumber(row.estimated_finish_position),
          estimatedFinishBandLow: parseNumber(row.estimated_finish_band_low),
          estimatedFinishBandHigh: parseNumber(row.estimated_finish_band_high),
          confidenceScore: parseNumber(row.confidence_score),
          recommendationRank: parseNumber(row.recommendation_rank),
          rationale: row.rationale ?? "",
        }));
      const pitWindows = (pitWindowsByDriver.get(featureRow.driver_id) ?? [])
        .sort((a, b) => (parseNumber(a.stop_number) ?? 0) - (parseNumber(b.stop_number) ?? 0))
        .map((row) => ({
          scenarioCode: row.scenario_code,
          stopNumber: parseNumber(row.stop_number),
          windowStartLap: parseNumber(row.window_start_lap),
          windowEndLap: parseNumber(row.window_end_lap),
          compoundIn: row.compound_in ?? null,
          compoundOut: row.compound_out ?? null,
        }));

      return {
        driverId: featureRow.driver_id,
        fullName: driverMap.get(featureRow.driver_id) ?? featureRow.driver_id,
        constructorId: featureRow.constructor_id,
        constructorName: constructorMap.get(featureRow.constructor_id) ?? featureRow.constructor_id,
        projectedFinish: parseNumber(projection?.projected_finish),
        finishBandLow: parseNumber(projection?.finish_band_low),
        finishBandHigh: parseNumber(projection?.finish_band_high),
        podiumProbability: parseNumber(projection?.podium_probability),
        winProbability: parseNumber(projection?.win_probability),
        baselineStrategyCode: projection?.baseline_strategy_code ?? featureRow.baseline_strategy_code ?? null,
        baselineTotalTimeS: parseNumber(projection?.baseline_total_time_s),
        confidenceScore: parseNumber(projection?.confidence_score ?? driverProfile?.confidence_score),
        strategyFeature: {
          nominalRaceLaps: parseNumber(featureRow.nominal_race_laps),
          baseRacePaceS: parseNumber(featureRow.base_race_pace_s),
          baseQualiPaceS: parseNumber(featureRow.base_quali_pace_s),
          paceEvolutionSPerLap: parseNumber(featureRow.pace_evolution_s_per_lap),
          pitLossS: parseNumber(featureRow.pit_loss_s),
          baselineStopCount: parseNumber(featureRow.baseline_stop_count),
          baselinePitWindowStartLap: parseNumber(featureRow.baseline_pit_window_start_lap),
          baselinePitWindowEndLap: parseNumber(featureRow.baseline_pit_window_end_lap),
          compoundProfiles: {
            soft: {
              deltaS: parseNumber(featureRow.compound_delta_soft_s),
              degradationSPerLap: parseNumber(featureRow.degradation_soft_s_per_lap),
              maxStintLaps: parseNumber(featureRow.stint_length_soft_laps),
            },
            medium: {
              deltaS: parseNumber(featureRow.compound_delta_medium_s),
              degradationSPerLap: parseNumber(featureRow.degradation_medium_s_per_lap),
              maxStintLaps: parseNumber(featureRow.stint_length_medium_laps),
            },
            hard: {
              deltaS: parseNumber(featureRow.compound_delta_hard_s),
              degradationSPerLap: parseNumber(featureRow.degradation_hard_s_per_lap),
              maxStintLaps: parseNumber(featureRow.stint_length_hard_laps),
            },
          },
        },
        driverProfile: {
          aggressiveTendencyScore: parseNumber(driverProfile?.aggressive_tendency_score),
          tyreManagementScore: parseNumber(driverProfile?.tyre_management_score),
          earlyPitBiasScore: parseNumber(driverProfile?.early_pit_bias_score),
          latePitBiasScore: parseNumber(driverProfile?.late_pit_bias_score),
          racecraftProxyScore: parseNumber(driverProfile?.racecraft_proxy_score),
          confidenceScore: parseNumber(driverProfile?.confidence_score),
        },
        constructorProfile: {
          pitEfficiencyScore: parseNumber(constructorProfile?.pit_efficiency_score),
          pitLossAdjustmentS: parseNumber(constructorProfile?.pit_loss_adjustment_s),
          strategySuccessProxy: parseNumber(constructorProfile?.strategy_success_proxy),
          doubleStackRiskScore: parseNumber(constructorProfile?.double_stack_risk_score),
          confidenceScore: parseNumber(constructorProfile?.confidence_score),
        },
        scenarios,
        pitWindows,
      };
    })
    .sort((a, b) => (a.projectedFinish ?? 99) - (b.projectedFinish ?? 99));

  return {
    race: {
      id: raceRow.id,
      season: Number(raceRow.season),
      round: Number(raceRow.round),
      raceName: raceRow.race_name,
      officialName: raceRow.official_name || null,
      circuitId: raceRow.circuit_id,
      circuitName: circuit?.name ?? raceRow.circuit_id,
      circuitCountry: circuit?.country ?? null,
      scheduledAt: raceRow.scheduled_at,
      sprintWeekend: parseBoolean(raceRow.sprint_weekend),
    },
    overview: {
      archetypeLabel: overviewRow.archetype_label ?? null,
      raceDifficulty: overviewRow.race_difficulty ?? null,
      nominalRaceLaps: parseNumber(overviewRow.nominal_race_laps),
      pitLossEstimateS: parseNumber(overviewRow.pit_loss_estimate_s),
      bestStrategyCode: overviewRow.best_strategy_code ?? null,
      bestStrategyLabel: overviewRow.best_strategy_label ?? null,
      keyInsight: overviewRow.key_insight ?? "",
      confidenceScore: parseNumber(overviewRow.confidence_score),
    },
    entrants,
  };
}

async function buildFromCsv(raceId: string): Promise<StrategyLabRaceProduct | null> {
  const [overviewRows, featureRows, driverProfileRows, constructorProfileRows, comparisonRows, pitRows, projectionRows, races, drivers, constructors, circuits] =
    await Promise.all([
      readDataCsv("strategy_lab", "strategy_lab_overview.csv") as Promise<StrategyLabOverviewRow[]>,
      readDataCsv("strategy_lab", "strategy_features.csv") as Promise<StrategyFeatureRow[]>,
      readDataCsv("strategy_lab", "driver_strategy_profile.csv") as Promise<DriverStrategyProfileRow[]>,
      readDataCsv("strategy_lab", "constructor_strategy_profile.csv") as Promise<ConstructorStrategyProfileRow[]>,
      readDataCsv("strategy_lab", "strategy_comparison.csv") as Promise<StrategyComparisonRow[]>,
      readDataCsv("strategy_lab", "pit_window.csv") as Promise<PitWindowRow[]>,
      readDataCsv("strategy_lab", "race_projection.csv") as Promise<RaceProjectionRow[]>,
      readCuratedCsv("races.csv") as Promise<Array<{ id: string; season: string; round: string; race_name: string; official_name: string; circuit_id: string; scheduled_at: string; sprint_weekend: string }>>,
      readCuratedCsv("drivers.csv") as Promise<DriverRow[]>,
      readCuratedCsv("constructors.csv") as Promise<ConstructorRow[]>,
      readCuratedCsv("circuits.csv") as Promise<CircuitRow[]>,
    ]);

  return buildProductFromRows({
    raceId,
    overviewRows,
    featureRows,
    driverProfileRows,
    constructorProfileRows,
    comparisonRows,
    pitRows,
    projectionRows,
    races: races as RaceRow[],
    drivers,
    constructors,
    circuits,
  });
}

async function buildFromSupabase(raceId: string): Promise<StrategyLabRaceProduct | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;

  const [overviewResult, raceResult, driversResult, constructorsResult, circuitsResult, featuresResult, driverProfileResult, constructorProfileResult, comparisonResult, pitWindowResult, projectionResult] =
    await Promise.all([
      supabase.from("strategy_lab_overview_view").select("race_id, race_name, circuit_id, archetype_label, race_difficulty, nominal_race_laps, pit_loss_estimate_s, best_strategy_code, best_strategy_label, key_insight, confidence_score").eq("race_id", raceId).single<StrategyLabOverviewRow>(),
      supabase.from("races").select("id, season, round, race_name, official_name, circuit_id, scheduled_at, sprint_weekend").eq("id", raceId).single<RaceRow>(),
      supabase.from("drivers").select("id, full_name"),
      supabase.from("constructors").select("id, name"),
      supabase.from("circuits").select("id, name, country"),
      supabase.from("strategy_features").select("*").eq("race_id", raceId),
      supabase.from("driver_strategy_profile").select("*").eq("race_id", raceId),
      supabase.from("constructor_strategy_profile").select("*").eq("race_id", raceId),
      supabase.from("strategy_comparison_view").select("*").eq("race_id", raceId),
      supabase.from("pit_window_view").select("*").eq("race_id", raceId),
      supabase.from("race_projection_view").select("*").eq("race_id", raceId),
    ]);

  if (
    overviewResult.error || raceResult.error || driversResult.error || constructorsResult.error || circuitsResult.error ||
    featuresResult.error || driverProfileResult.error || constructorProfileResult.error || comparisonResult.error ||
    pitWindowResult.error || projectionResult.error
  ) {
    throw new Error("Failed to load Strategy Lab product data.");
  }

  return buildProductFromRows({
    raceId,
    overviewRows: overviewResult.data ? [overviewResult.data] : [],
    featureRows: (featuresResult.data ?? []) as StrategyFeatureRow[],
    driverProfileRows: (driverProfileResult.data ?? []) as DriverStrategyProfileRow[],
    constructorProfileRows: (constructorProfileResult.data ?? []) as ConstructorStrategyProfileRow[],
    comparisonRows: (comparisonResult.data ?? []) as StrategyComparisonRow[],
    pitRows: (pitWindowResult.data ?? []) as PitWindowRow[],
    projectionRows: (projectionResult.data ?? []) as RaceProjectionRow[],
    races: raceResult.data ? [raceResult.data] : [],
    drivers: (driversResult.data ?? []) as DriverRow[],
    constructors: (constructorsResult.data ?? []) as ConstructorRow[],
    circuits: (circuitsResult.data ?? []) as CircuitRow[],
  });
}

export const getStrategyLabRaceProduct = cache(async (raceId: string): Promise<StrategyLabRaceProduct | null> => {
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    try {
      return await buildFromSupabase(raceId);
    } catch {
      return buildFromCsv(raceId);
    }
  }
  return buildFromCsv(raceId);
});
