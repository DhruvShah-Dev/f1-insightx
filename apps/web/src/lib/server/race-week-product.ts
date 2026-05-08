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
  signalConfidence: number | null;
};

export type RaceWeekProduct = {
  overview: RaceWeekProductOverview;
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
  }>;
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
  entity_type: string;
  entity_id: string | null;
  storyline_type: string;
  priority_rank: number | string;
  headline: string;
  body: string;
  confidence_band: string;
  signal_confidence: number | string | null;
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

async function buildProductFromCsv(): Promise<RaceWeekProduct | null> {
  const [overviewRows, driverBoardRows, constructorBoardRows, strategyRows, storylineRows, races, circuits] = await Promise.all([
    readCsvFile<RaceWeekOverviewRow>("raceWeek.overview"),
    readCsvFile<DriverBoardRow>("raceWeek.driverBoard"),
    readCsvFile<ConstructorBoardRow>("raceWeek.constructorBoard"),
    readCsvFile<StrategyRow>("raceWeek.strategy"),
    readCsvFile<StorylineRow>("raceWeek.storylines"),
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

  return attachRaceWeekRuntimeMetadata({
    overview: {
      currentSeason: Number(overviewRow.season),
      latestCompletedRace,
      nextRace,
      archetypeLabel: overviewRow.archetype_label ?? null,
      strategyDifficulty: overviewRow.strategy_difficulty ?? null,
      weatherRiskIndex: parseNumber(overviewRow.weather_risk_index),
      signalConfidence: parseNumber(overviewRow.signal_confidence),
    },
    driverBoard: driverBoardRows
      .filter((row) => row && row.driver_id)
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
      .filter((row) => row && row.constructor_id)
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
      .filter((row) => row && row.driver_id)
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
      .filter((row) => row && row.storyline_type)
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
      })),
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

  const circuitIds = [overviewRow.circuit_id];
  const latestCompletedRaceId = overviewRow.latest_completed_race_id ?? null;

  const [circuitsResult, driverBoardResult, constructorBoardResult, strategyResult, storylineResult] = await Promise.all([
    supabase.from("circuits").select("id, name, country").in("id", circuitIds),
    supabase.from("race_week_driver_board_view").select("driver_id, driver_name, constructor_id, constructor_name, long_run_pace_s, gap_to_long_run_best_s, one_lap_pace_s, gap_to_one_lap_best_s, degradation_s_per_lap, readiness_score, signal_confidence, projected_finish, summary").eq("race_id", overviewRow.race_id).order("readiness_score", { ascending: false }),
    supabase.from("race_week_constructor_board_view").select("constructor_id, constructor_name, long_run_pace_s, one_lap_pace_s, degradation_index, readiness_score, signal_confidence, summary").eq("race_id", overviewRow.race_id).order("readiness_score", { ascending: false }),
    supabase.from("race_week_strategy_view").select("driver_id, constructor_id, recommended_stop_count, preferred_primary_compound, preferred_secondary_compound, pit_window_start_lap, pit_window_end_lap, degradation_risk, strategy_confidence, rationale").eq("race_id", overviewRow.race_id),
    supabase.from("race_week_storylines_view").select("entity_type, entity_id, storyline_type, priority_rank, headline, body, confidence_band, signal_confidence").eq("race_id", overviewRow.race_id).order("priority_rank", { ascending: true }),
  ]);

  if (
    circuitsResult.error ||
    driverBoardResult.error ||
    constructorBoardResult.error ||
    strategyResult.error ||
    storylineResult.error
  ) {
    throw new Error("Failed to load Race Week product views.");
  }

  const circuitMap = new Map(((circuitsResult.data ?? []) as CircuitRow[]).map((circuit) => [circuit.id, circuit]));
  let latestCompletedRace: RaceWeekCanonicalRaceRef | null = null;
  if (latestCompletedRaceId) {
    const latestCompletedRaceResult = await supabase
      .from("races")
      .select("id, season, round, race_name, circuit_id, scheduled_at")
      .eq("id", latestCompletedRaceId)
      .single<RaceRow>();
    if (latestCompletedRaceResult.error) {
      throw new Error("Failed to load latest completed race context.");
    }
    const latestRaceRow = latestCompletedRaceResult.data;
    if (latestRaceRow) {
      latestCompletedRace = mapRaceRef(latestRaceRow, circuitMap.get(latestRaceRow.circuit_id) ?? null);
    }
  }

  return attachRaceWeekRuntimeMetadata({
    overview: {
      currentSeason: Number(overviewRow.season),
      latestCompletedRace,
      nextRace: mapRaceRef(overviewRow, circuitMap.get(overviewRow.circuit_id) ?? null),
      archetypeLabel: overviewRow.archetype_label ?? null,
      strategyDifficulty: overviewRow.strategy_difficulty ?? null,
      weatherRiskIndex: parseNumber(overviewRow.weather_risk_index),
      signalConfidence: parseNumber(overviewRow.signal_confidence),
    },
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
    })),
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
