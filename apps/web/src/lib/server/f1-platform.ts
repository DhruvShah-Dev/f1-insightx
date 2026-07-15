import { cache } from "react";
import { parseNumber, readCsvFile } from "@/lib/server/csv";
import { getRaceWeekProductResult } from "@/lib/server/race-week-product";
import { getRuntimeData, resolveRuntimeSource, type RuntimeSourceResult } from "@/lib/server/runtime-source";
import { getSupabasePublicClient } from "@/lib/server/supabase";
import { compareSeasonRoundDesc, groupBy, roundTo } from "@/lib/server/utils";

type CsvRace = {
  id: string;
  season: string;
  round: string;
  race_name: string;
  circuit_id: string;
  scheduled_at: string;
};

type CsvCircuit = {
  id: string;
  name: string;
  country: string;
  location: string;
};

type CsvDriver = {
  id: string;
  full_name: string;
  nationality: string;
};

type CsvConstructor = {
  id: string;
  name: string;
};

type CsvRaceResult = {
  race_id: string;
};

type CsvDriverStanding = {
  race_id: string;
  season: string;
  round: string;
  driver_id: string;
  constructor_id: string;
  standing_position: string;
  points: string;
  wins: string;
};

type CsvConstructorStanding = {
  race_id: string;
  season: string;
  round: string;
  constructor_id: string;
  standing_position: string;
  points: string;
  wins: string;
};

type CsvRaceWeekContext = {
  race_id: string;
  season: string;
  round: string;
  race_name: string;
  circuit_id: string;
  scheduled_at: string;
  status: string;
  is_next_race: string;
  latest_completed_race_id: string;
  latest_completed_season: string;
  latest_completed_round: string;
  latest_completed_race_name: string;
};

type CsvPredictionSnapshot = {
  race_id: string;
  season: string;
  round: string;
  driver_id: string;
  constructor_id: string;
  generated_at: string;
  model_version: string;
  predicted_score: string;
  projected_finish: string;
  winner_probability: string;
  podium_probability: string;
  top10_probability: string;
  rationale: string;
};

type CsvFantasyInput = {
  season: string;
  round: string;
  race_id: string;
  entity_type: string;
  entity_id: string;
  constructor_id: string;
  projected_score: string;
  price_estimate: string;
  value_score: string;
  winner_probability: string;
  podium_probability: string;
  top10_probability: string;
  volatility_proxy: string;
};

type SupabaseRaceRow = {
  id: string;
  season: number;
  round: number;
  race_name: string;
  circuit_id: string;
  scheduled_at: string;
};

type SupabaseCircuitRow = {
  id: string;
  name: string;
  country: string | null;
};

type SupabaseDriverRow = {
  id: string;
  full_name: string;
  nationality: string | null;
};

type SupabaseConstructorRow = {
  id: string;
  name: string;
};

type SupabaseDriverStandingRow = {
  race_id: string;
  driver_id: string;
  constructor_id: string;
  standing_position: number;
  points: number;
  wins: number | null;
};

type SupabaseConstructorStandingRow = {
  race_id: string;
  constructor_id: string;
  standing_position: number;
  points: number;
  wins: number | null;
};

type SupabasePredictionRow = {
  driver_id: string;
  constructor_id: string;
  generated_at: string;
  model_version: string;
  projected_finish: number;
  predicted_score: number;
  winner_probability: number;
  podium_probability: number;
  top10_probability: number;
  rationale: string | null;
};

type SupabaseFantasyInputRow = {
  season: number;
  round: number;
  race_id: string;
  entity_type: "driver" | "constructor";
  entity_id: string;
  constructor_id: string | null;
  projected_score: number;
  price_estimate: number;
  value_score: number;
  winner_probability: number;
  podium_probability: number;
  top10_probability: number;
  volatility_proxy: number;
};

export type CanonicalRaceRef = {
  id: string;
  season: number;
  round: number;
  raceName: string;
  circuitId: string;
  circuitName: string;
  circuitCountry: string | null;
  scheduledAt: string;
};

export type DriverStandingSnapshot = {
  driverId: string;
  driverName: string;
  nationality: string | null;
  constructorId: string;
  constructorName: string;
  standingPosition: number;
  points: number;
  wins: number;
};

export type ConstructorStandingSnapshot = {
  constructorId: string;
  constructorName: string;
  standingPosition: number;
  points: number;
  wins: number;
};

export type RaceWeekOverview = {
  currentSeason: number;
  latestCompletedRace: CanonicalRaceRef | null;
  nextRace: CanonicalRaceRef | null;
};

export type UpcomingPredictionEntry = {
  driverId: string;
  driverName: string;
  nationality: string | null;
  constructorId: string;
  constructorName: string;
  projectedFinish: number;
  predictedScore: number;
  winnerProbability: number;
  podiumProbability: number;
  top10Probability: number;
  rationale: string;
};

export type UpcomingRacePrediction = {
  race: CanonicalRaceRef;
  generatedAt: string;
  modelVersion: string;
  entries: UpcomingPredictionEntry[];
  constructorOutlook: Array<{
    constructorId: string;
    constructorName: string;
    averageProjectedFinish: number;
    averageWinnerProbability: number;
    totalPodiumProbability: number;
  }>;
};

export type CanonicalFantasyInput = {
  entityType: "driver" | "constructor";
  entityId: string;
  raceId: string;
  season: number;
  round: number;
  constructorId: string | null;
  projectedScore: number;
  priceEstimate: number;
  valueScore: number;
  winnerProbability: number;
  podiumProbability: number;
  top10Probability: number;
  volatilityProxy: number;
};

type RaceWeekOverviewResult = RuntimeSourceResult<RaceWeekOverview>;
type DriverStandingsSnapshot = {
  season: number;
  round: number;
  race: CanonicalRaceRef;
  items: DriverStandingSnapshot[];
};
type DriverStandingsSnapshotResult = RuntimeSourceResult<DriverStandingsSnapshot>;
type ConstructorStandingsSnapshot = {
  season: number;
  round: number;
  race: CanonicalRaceRef;
  items: ConstructorStandingSnapshot[];
};
type ConstructorStandingsSnapshotResult = RuntimeSourceResult<ConstructorStandingsSnapshot>;
type UpcomingRacePredictionResult = RuntimeSourceResult<UpcomingRacePrediction>;

type CsvPlatformDataset = {
  races: CsvRace[];
  circuits: Map<string, CsvCircuit>;
  drivers: Map<string, CsvDriver>;
  constructors: Map<string, CsvConstructor>;
  raceResults: CsvRaceResult[];
  driverStandings: CsvDriverStanding[];
  constructorStandings: CsvConstructorStanding[];
  raceWeekContext: CsvRaceWeekContext[];
  predictionSnapshots: CsvPredictionSnapshot[];
  fantasyInputs: CsvFantasyInput[];
};

const loadCsvPlatformDataset = cache(async (): Promise<CsvPlatformDataset> => {
  const [races, circuits, drivers, constructors, raceResults, driverStandings, constructorStandings, raceWeekContext, predictionSnapshots, fantasyInputs] =
    await Promise.all([
      readCsvFile<CsvRace>("curated.races"),
      readCsvFile<CsvCircuit>("curated.circuits"),
      readCsvFile<CsvDriver>("curated.drivers"),
      readCsvFile<CsvConstructor>("curated.constructors"),
      readCsvFile<CsvRaceResult>("curated.raceResults"),
      readCsvFile<CsvDriverStanding>("curated.driverStandings"),
      readCsvFile<CsvConstructorStanding>("curated.constructorStandings"),
      readCsvFile<CsvRaceWeekContext>("curated.raceWeekContext"),
      readCsvFile<CsvPredictionSnapshot>("curated.predictionSnapshots"),
      readCsvFile<CsvFantasyInput>("curated.fantasyInputs"),
    ]);

  return {
    races,
    circuits: new Map(circuits.map((item) => [item.id, item])),
    drivers: new Map(drivers.map((item) => [item.id, item])),
    constructors: new Map(constructors.map((item) => [item.id, item])),
    raceResults,
    driverStandings,
    constructorStandings,
    raceWeekContext,
    predictionSnapshots,
    fantasyInputs,
  };
});

export const getRaceWeekOverview = cache(async (): Promise<RaceWeekOverview | null> => {
  const result = await getRaceWeekOverviewResult();
  return getRuntimeData(result);
});

export const getCurrentDriverStandingsSnapshot = cache(async (): Promise<DriverStandingsSnapshot | null> => {
  const result = await getCurrentDriverStandingsSnapshotResult();
  return getRuntimeData(result);
});

export const getCurrentConstructorStandingsSnapshot = cache(async (): Promise<ConstructorStandingsSnapshot | null> => {
  const result = await getCurrentConstructorStandingsSnapshotResult();
  return getRuntimeData(result);
});

export const getUpcomingRacePrediction = cache(async (): Promise<UpcomingRacePrediction | null> => {
  const result = await getUpcomingRacePredictionResult();
  return getRuntimeData(result);
});

export const getFantasyInputsForCurrentRaceWeek = cache(async (season?: number, round?: number) => {
  const supabase = getSupabasePublicClient();
  if (supabase) {
    try {
      return await getFantasyInputsForCurrentRaceWeekFromSupabase(season, round);
    } catch {
      return getFantasyInputsForCurrentRaceWeekFromCsv(season, round);
    }
  }

  return getFantasyInputsForCurrentRaceWeekFromCsv(season, round);
});

function describeOverview(overview: RaceWeekOverview) {
  return {
    eventId: overview.nextRace?.id ?? overview.latestCompletedRace?.id ?? null,
    season: overview.nextRace?.season ?? overview.latestCompletedRace?.season ?? overview.currentSeason,
    round: overview.nextRace?.round ?? overview.latestCompletedRace?.round ?? null,
  };
}

function describeSnapshot(snapshot: DriverStandingsSnapshot | ConstructorStandingsSnapshot) {
  return {
    eventId: snapshot.race.id,
    season: snapshot.season,
    round: snapshot.round,
  };
}

function compareSnapshotRecency(
  left: DriverStandingsSnapshot | ConstructorStandingsSnapshot,
  right: DriverStandingsSnapshot | ConstructorStandingsSnapshot,
) {
  return left.season - right.season || left.round - right.round;
}

async function resolveFreshestHomepageSnapshot<T extends DriverStandingsSnapshot | ConstructorStandingsSnapshot>(
  databaseLoad: () => Promise<T | null>,
  csvLoad: () => Promise<T | null>,
): Promise<RuntimeSourceResult<T>> {
  let databaseReason: string | null = null;
  let csvReason: string | null = null;
  let databaseData: T | null = null;
  let csvData: T | null = null;

  try {
    databaseData = await databaseLoad();
    if (!databaseData) {
      databaseReason = "Primary canonical_tables returned no data.";
    }
  } catch (error) {
    databaseReason = error instanceof Error ? error.message : "Primary canonical_tables failed.";
  }

  try {
    csvData = await csvLoad();
    if (!csvData) {
      csvReason = "Degraded curated_csv returned no data.";
    }
  } catch (error) {
    csvReason = error instanceof Error ? error.message : "Degraded curated_csv failed.";
  }

  if (databaseData && csvData && compareSnapshotRecency(csvData, databaseData) > 0) {
    return {
      mode: "degraded",
      data: csvData,
      meta: {
        surface: "homepage",
        mode: "degraded",
        sourceKind: "csv-canonical",
        sourceLabel: "curated_csv",
        reason: `curated_csv is newer than canonical_tables (${csvData.race.id} vs ${databaseData.race.id}).`,
        generatedAt: null,
        buildVersion: null,
        ...describeSnapshot(csvData),
      },
    };
  }

  if (databaseData) {
    return {
      mode: "primary",
      data: databaseData,
      meta: {
        surface: "homepage",
        mode: "primary",
        sourceKind: "database",
        sourceLabel: "canonical_tables",
        reason: null,
        generatedAt: null,
        buildVersion: null,
        ...describeSnapshot(databaseData),
      },
    };
  }

  if (csvData) {
    return {
      mode: "degraded",
      data: csvData,
      meta: {
        surface: "homepage",
        mode: "degraded",
        sourceKind: "csv-canonical",
        sourceLabel: "curated_csv",
        reason: databaseReason,
        generatedAt: null,
        buildVersion: null,
        ...describeSnapshot(csvData),
      },
    };
  }

  return {
    mode: "unavailable",
    data: null,
    meta: {
      surface: "homepage",
      mode: "unavailable",
      sourceKind: null,
      sourceLabel: null,
      reason: `Primary failed (${databaseReason ?? "unknown"}); degraded failed (${csvReason ?? "unknown"}).`,
      generatedAt: null,
      buildVersion: null,
      eventId: null,
      season: null,
      round: null,
    },
  };
}

function describePrediction(prediction: UpcomingRacePrediction) {
  return {
    eventId: prediction.race.id,
    season: prediction.race.season,
    round: prediction.race.round,
    generatedAt: prediction.generatedAt,
    buildVersion: prediction.modelVersion,
  };
}

export const getRaceWeekOverviewResult = cache(async (): Promise<RaceWeekOverviewResult> => {
  const raceWeekProductResult = await getRaceWeekProductResult();
  if (raceWeekProductResult.mode !== "unavailable") {
    const productOverview = raceWeekProductResult.data.overview;
    if (!(productOverview?.nextRace || productOverview?.latestCompletedRace)) {
      return resolveRuntimeSource({
        surface: "homepage",
        primary: {
          sourceKind: "database",
          sourceLabel: "canonical_tables",
          load: async () => {
            const supabase = getSupabasePublicClient();
            if (!supabase) {
              return null;
            }
            return getRaceWeekOverviewFromSupabase();
          },
          describe: describeOverview,
        },
        degraded: {
          sourceKind: "csv-canonical",
          sourceLabel: "curated_csv",
          load: getRaceWeekOverviewFromCsv,
          describe: describeOverview,
        },
      });
    }

    const overview = {
      currentSeason: productOverview.currentSeason,
      latestCompletedRace: productOverview.latestCompletedRace,
      nextRace: productOverview.nextRace,
    };

    return {
      mode: raceWeekProductResult.mode,
      data: overview,
      meta: {
        ...raceWeekProductResult.meta,
        surface: "homepage",
        ...describeOverview(overview),
      },
    };
  }

  return resolveRuntimeSource({
    surface: "homepage",
    primary: {
      sourceKind: "database",
      sourceLabel: "canonical_tables",
      load: async () => {
        const supabase = getSupabasePublicClient();
        if (!supabase) {
          return null;
        }
        return getRaceWeekOverviewFromSupabase();
      },
      describe: describeOverview,
    },
    degraded: {
      sourceKind: "csv-canonical",
      sourceLabel: "curated_csv",
      load: getRaceWeekOverviewFromCsv,
      describe: describeOverview,
    },
  });
});

export const getCurrentDriverStandingsSnapshotResult = cache(async (): Promise<DriverStandingsSnapshotResult> =>
  resolveFreshestHomepageSnapshot(
    async () => {
      const supabase = getSupabasePublicClient();
      if (!supabase) {
        return null;
      }
      return getCurrentDriverStandingsSnapshotFromSupabase();
    },
    getCurrentDriverStandingsSnapshotFromCsv,
  ),
);

export const getCurrentConstructorStandingsSnapshotResult = cache(async (): Promise<ConstructorStandingsSnapshotResult> =>
  resolveFreshestHomepageSnapshot(
    async () => {
      const supabase = getSupabasePublicClient();
      if (!supabase) {
        return null;
      }
      return getCurrentConstructorStandingsSnapshotFromSupabase();
    },
    getCurrentConstructorStandingsSnapshotFromCsv,
  ),
);

export const getUpcomingRacePredictionResult = cache(async (): Promise<UpcomingRacePredictionResult> =>
  resolveRuntimeSource({
    surface: "homepage",
    primary: {
      sourceKind: "database",
      sourceLabel: "canonical_tables",
      load: async () => {
        const supabase = getSupabasePublicClient();
        if (!supabase) {
          return null;
        }
        return getUpcomingRacePredictionFromSupabase();
      },
      describe: describePrediction,
    },
    degraded: {
      sourceKind: "csv-canonical",
      sourceLabel: "curated_csv",
      load: getUpcomingRacePredictionFromCsv,
      describe: describePrediction,
    },
  }),
);

async function getRaceWeekOverviewFromCsv(): Promise<RaceWeekOverview | null> {
  const dataset = await loadCsvPlatformDataset();
  return deriveCsvRaceWeekOverview(dataset);
}

async function getCurrentDriverStandingsSnapshotFromCsv() {
  const dataset = await loadCsvPlatformDataset();
  const overview = await getRaceWeekOverviewFromCsv();
  if (!overview?.latestCompletedRace) {
    return null;
  }

  const items = dataset.driverStandings
    .filter((row) => row.race_id === overview.latestCompletedRace?.id)
    .sort((left, right) => compareDriverStandingRows(left, right))
    .map((row) => ({
      driverId: row.driver_id,
      driverName: dataset.drivers.get(row.driver_id)?.full_name ?? row.driver_id,
      nationality: dataset.drivers.get(row.driver_id)?.nationality ?? null,
      constructorId: row.constructor_id,
      constructorName: dataset.constructors.get(row.constructor_id)?.name ?? row.constructor_id,
      standingPosition: Number(row.standing_position),
      points: Number(row.points),
      wins: Number(row.wins ?? 0),
    }));

  return {
    season: overview.latestCompletedRace.season,
    round: overview.latestCompletedRace.round,
    race: overview.latestCompletedRace,
    items: sortDriverStandingSnapshots(items),
  };
}

async function getCurrentConstructorStandingsSnapshotFromCsv() {
  const dataset = await loadCsvPlatformDataset();
  const overview = await getRaceWeekOverviewFromCsv();
  if (!overview?.latestCompletedRace) {
    return null;
  }

  const items = dataset.constructorStandings
    .filter((row) => row.race_id === overview.latestCompletedRace?.id)
    .sort(
      (left, right) =>
        Number(right.points) - Number(left.points) ||
        Number(right.wins) - Number(left.wins) ||
        Number(left.standing_position) - Number(right.standing_position) ||
        left.constructor_id.localeCompare(right.constructor_id),
    )
    .map((row) => ({
      constructorId: row.constructor_id,
      constructorName: dataset.constructors.get(row.constructor_id)?.name ?? row.constructor_id,
      standingPosition: Number(row.standing_position),
      points: Number(row.points),
      wins: Number(row.wins ?? 0),
    }));

  return {
    season: overview.latestCompletedRace.season,
    round: overview.latestCompletedRace.round,
    race: overview.latestCompletedRace,
    items: sortConstructorStandingSnapshots(items),
  };
}

async function getUpcomingRacePredictionFromCsv(): Promise<UpcomingRacePrediction | null> {
  const dataset = await loadCsvPlatformDataset();
  const overview = await getRaceWeekOverviewFromCsv();
  if (!overview?.nextRace) {
    return null;
  }

  const entries = dataset.predictionSnapshots
    .filter((row) => row.race_id === overview.nextRace?.id)
    .sort((left, right) => Number(left.projected_finish) - Number(right.projected_finish))
    .map((row) => ({
      driverId: row.driver_id,
      driverName: dataset.drivers.get(row.driver_id)?.full_name ?? row.driver_id,
      nationality: dataset.drivers.get(row.driver_id)?.nationality ?? null,
      constructorId: row.constructor_id,
      constructorName: dataset.constructors.get(row.constructor_id)?.name ?? row.constructor_id,
      projectedFinish: Number(row.projected_finish),
      predictedScore: Number(row.predicted_score),
      winnerProbability: Number(row.winner_probability),
      podiumProbability: Number(row.podium_probability),
      top10Probability: Number(row.top10_probability),
      rationale: row.rationale,
    }));

  if (entries.length === 0) {
    return null;
  }

  return {
    race: overview.nextRace,
    generatedAt: dataset.predictionSnapshots.find((row) => row.race_id === overview.nextRace?.id)?.generated_at ?? "",
    modelVersion: dataset.predictionSnapshots.find((row) => row.race_id === overview.nextRace?.id)?.model_version ?? "pre_race_ranker_v1",
    entries,
    constructorOutlook: buildConstructorOutlook(entries),
  };
}

async function getFantasyInputsForCurrentRaceWeekFromCsv(season?: number, round?: number) {
  const dataset = await loadCsvPlatformDataset();
  const overview = await getRaceWeekOverviewFromCsv();
  const targetSeason = season ?? overview?.nextRace?.season ?? overview?.latestCompletedRace?.season;
  const targetRound = round ?? overview?.nextRace?.round;
  if (!targetSeason || !targetRound) {
    return [];
  }

  return dataset.fantasyInputs
    .filter((row) => Number(row.season) === targetSeason && Number(row.round) === targetRound)
    .map((row) => ({
      entityType: row.entity_type as "driver" | "constructor",
      entityId: row.entity_id,
      raceId: row.race_id,
      season: Number(row.season),
      round: Number(row.round),
      constructorId: row.constructor_id || null,
      projectedScore: Number(row.projected_score),
      priceEstimate: Number(row.price_estimate),
      valueScore: Number(row.value_score),
      winnerProbability: Number(row.winner_probability),
      podiumProbability: Number(row.podium_probability),
      top10Probability: Number(row.top10_probability),
      volatilityProxy: Number(row.volatility_proxy),
    })) satisfies CanonicalFantasyInput[];
}

async function getRaceWeekOverviewFromSupabase(): Promise<RaceWeekOverview | null> {
  const supabase = getSupabasePublicClient();
  if (!supabase) {
    return null;
  }
  const client = supabase;

  async function readCompletedRaceIds() {
    const pageSize = 1000;
    const raceIds: string[] = [];

    for (let from = 0; ; from += pageSize) {
      const { data, error } = await client
        .from("race_results")
        .select("race_id")
        .range(from, from + pageSize - 1);

      if (error) {
        throw new Error("Failed to load canonical race week overview.");
      }

      raceIds.push(...((data ?? []) as Array<{ race_id: string }>).map((row) => String(row.race_id)));
      if (!data || data.length < pageSize) {
        break;
      }
    }

    return raceIds;
  }

  const [racesResult, completedRaceIdRows] = await Promise.all([
    client
      .from("races")
      .select("id, season, round, race_name, circuit_id, scheduled_at")
      .order("season", { ascending: true })
      .order("round", { ascending: true }),
    readCompletedRaceIds(),
  ]);

  if (racesResult.error) {
    throw new Error("Failed to load canonical race week overview.");
  }

  const raceRows = (racesResult.data ?? []) as SupabaseRaceRow[];
  const completedRaceIds = new Set(completedRaceIdRows);
  const { latestCompletedRaceRow, nextRaceRow } = deriveSupabaseRaceRows(raceRows, completedRaceIds);
  const currentSeason = nextRaceRow?.season ?? latestCompletedRaceRow?.season ?? null;
  if (!currentSeason) {
    return null;
  }

  const circuitIds = [latestCompletedRaceRow?.circuit_id, nextRaceRow?.circuit_id].filter(Boolean);
  const { data: circuits, error: circuitsError } = await supabase
    .from("circuits")
    .select("id, name, country")
    .in("id", circuitIds);

  if (circuitsError) {
    throw new Error("Failed to load canonical race week overview.");
  }

  const circuitRows = (circuits ?? []) as SupabaseCircuitRow[];
  const raceMap = new Map(raceRows.map((race) => [race.id, race]));
  const circuitMap = new Map(circuitRows.map((circuit) => [circuit.id, circuit]));

  return {
    currentSeason,
    latestCompletedRace: latestCompletedRaceRow
      ? mapSupabaseRaceRef(latestCompletedRaceRow.id, raceMap, circuitMap)
      : null,
    nextRace: nextRaceRow ? mapSupabaseRaceRef(nextRaceRow.id, raceMap, circuitMap) : null,
  };
}

async function getCurrentDriverStandingsSnapshotFromSupabase() {
  const supabase = getSupabasePublicClient();
  const overview = await getRaceWeekOverviewFromSupabase();
  if (!supabase || !overview?.latestCompletedRace) {
    return null;
  }

  const [standingsResult, driversResult, constructorsResult] = await Promise.all([
    supabase
      .from("driver_standings")
      .select("race_id, driver_id, constructor_id, standing_position, points, wins")
      .eq("race_id", overview.latestCompletedRace.id)
      .order("standing_position", { ascending: true }),
    supabase.from("drivers").select("id, full_name, nationality"),
    supabase.from("constructors").select("id, name"),
  ]);

  if (standingsResult.error || driversResult.error || constructorsResult.error) {
    throw new Error("Failed to load canonical driver standings.");
  }

  const driverRows = (driversResult.data ?? []) as SupabaseDriverRow[];
  const constructorRows = (constructorsResult.data ?? []) as SupabaseConstructorRow[];
  const standingsRows = (standingsResult.data ?? []) as SupabaseDriverStandingRow[];
  if (standingsRows.length === 0) {
    return null;
  }

  const driverMap = new Map(driverRows.map((driver) => [driver.id, driver]));
  const constructorMap = new Map(constructorRows.map((constructor) => [constructor.id, constructor]));

  return {
    season: overview.latestCompletedRace.season,
    round: overview.latestCompletedRace.round,
    race: overview.latestCompletedRace,
    items: sortDriverStandingSnapshots(standingsRows.map((row) => ({
      driverId: String(row.driver_id),
      driverName: driverMap.get(String(row.driver_id))?.full_name ?? String(row.driver_id),
      nationality: driverMap.get(String(row.driver_id))?.nationality ?? null,
      constructorId: String(row.constructor_id),
      constructorName: constructorMap.get(String(row.constructor_id))?.name ?? String(row.constructor_id),
      standingPosition: Number(row.standing_position),
      points: Number(row.points),
      wins: Number(row.wins ?? 0),
    }))),
  };
}

async function getCurrentConstructorStandingsSnapshotFromSupabase() {
  const supabase = getSupabasePublicClient();
  const overview = await getRaceWeekOverviewFromSupabase();
  if (!supabase || !overview?.latestCompletedRace) {
    return null;
  }

  const [standingsResult, constructorsResult] = await Promise.all([
    supabase
      .from("constructor_standings")
      .select("race_id, constructor_id, standing_position, points, wins")
      .eq("race_id", overview.latestCompletedRace.id)
      .order("standing_position", { ascending: true }),
    supabase.from("constructors").select("id, name"),
  ]);

  if (standingsResult.error || constructorsResult.error) {
    throw new Error("Failed to load canonical constructor standings.");
  }

  const constructorRows = (constructorsResult.data ?? []) as SupabaseConstructorRow[];
  const standingsRows = (standingsResult.data ?? []) as SupabaseConstructorStandingRow[];
  if (standingsRows.length === 0) {
    return null;
  }

  const constructorMap = new Map(constructorRows.map((constructor) => [constructor.id, constructor]));
  return {
    season: overview.latestCompletedRace.season,
    round: overview.latestCompletedRace.round,
    race: overview.latestCompletedRace,
    items: sortConstructorStandingSnapshots(standingsRows.map((row) => ({
      constructorId: String(row.constructor_id),
      constructorName: constructorMap.get(String(row.constructor_id))?.name ?? String(row.constructor_id),
      standingPosition: Number(row.standing_position),
      points: Number(row.points),
      wins: Number(row.wins ?? 0),
    }))),
  };
}

async function getUpcomingRacePredictionFromSupabase(): Promise<UpcomingRacePrediction | null> {
  const supabase = getSupabasePublicClient();
  const overview = await getRaceWeekOverviewFromSupabase();
  if (!supabase || !overview?.nextRace) {
    return null;
  }

  const [predictionResult, driversResult, constructorsResult] = await Promise.all([
    supabase
      .from("prediction_snapshots")
      .select("race_id, driver_id, constructor_id, generated_at, model_version, predicted_score, projected_finish, winner_probability, podium_probability, top10_probability, rationale")
      .eq("race_id", overview.nextRace.id)
      .order("projected_finish", { ascending: true }),
    supabase.from("drivers").select("id, full_name, nationality"),
    supabase.from("constructors").select("id, name"),
  ]);

  if (predictionResult.error || driversResult.error || constructorsResult.error) {
    throw new Error("Failed to load upcoming race prediction.");
  }

  const driverRows = (driversResult.data ?? []) as SupabaseDriverRow[];
  const constructorRows = (constructorsResult.data ?? []) as SupabaseConstructorRow[];
  const predictionRows = (predictionResult.data ?? []) as SupabasePredictionRow[];
  const driverMap = new Map(driverRows.map((driver) => [driver.id, driver]));
  const constructorMap = new Map(constructorRows.map((constructor) => [constructor.id, constructor]));
  const entries = predictionRows.map((row) => ({
    driverId: String(row.driver_id),
    driverName: driverMap.get(String(row.driver_id))?.full_name ?? String(row.driver_id),
    nationality: driverMap.get(String(row.driver_id))?.nationality ?? null,
    constructorId: String(row.constructor_id),
    constructorName: constructorMap.get(String(row.constructor_id))?.name ?? String(row.constructor_id),
    projectedFinish: Number(row.projected_finish),
    predictedScore: Number(row.predicted_score),
    winnerProbability: Number(row.winner_probability),
    podiumProbability: Number(row.podium_probability),
    top10Probability: Number(row.top10_probability),
    rationale: row.rationale ?? "",
  }));

  if (entries.length === 0) {
    return null;
  }

  return {
    race: overview.nextRace,
    generatedAt: String(predictionRows[0]?.generated_at ?? ""),
    modelVersion: String(predictionRows[0]?.model_version ?? "pre_race_ranker_v1"),
    entries,
    constructorOutlook: buildConstructorOutlook(entries),
  };
}

async function getFantasyInputsForCurrentRaceWeekFromSupabase(season?: number, round?: number) {
  const supabase = getSupabasePublicClient();
  const overview = await getRaceWeekOverviewFromSupabase();
  if (!supabase) {
    return [];
  }
  const targetSeason = season ?? overview?.nextRace?.season ?? overview?.latestCompletedRace?.season;
  const targetRound = round ?? overview?.nextRace?.round;
  if (!targetSeason || !targetRound) {
    return [];
  }

  const { data, error } = await supabase
    .from("fantasy_inputs")
    .select("season, round, race_id, entity_type, entity_id, constructor_id, projected_score, price_estimate, value_score, winner_probability, podium_probability, top10_probability, volatility_proxy")
    .eq("season", targetSeason)
    .eq("round", targetRound);

  if (error) {
    throw new Error("Failed to load fantasy inputs.");
  }

  const fantasyRows = (data ?? []) as SupabaseFantasyInputRow[];

  return fantasyRows.map((row) => ({
    entityType: row.entity_type as "driver" | "constructor",
    entityId: String(row.entity_id),
    raceId: String(row.race_id),
    season: Number(row.season),
    round: Number(row.round),
    constructorId: row.constructor_id ? String(row.constructor_id) : null,
    projectedScore: Number(row.projected_score),
    priceEstimate: Number(row.price_estimate),
    valueScore: Number(row.value_score),
    winnerProbability: Number(row.winner_probability),
    podiumProbability: Number(row.podium_probability),
    top10Probability: Number(row.top10_probability),
    volatilityProxy: Number(row.volatility_proxy),
  })) satisfies CanonicalFantasyInput[];
}

function mapRaceRef(raceId: string, dataset: CsvPlatformDataset): CanonicalRaceRef {
  const race = dataset.races.find((item) => item.id === raceId);
  if (!race) {
    return {
      id: raceId,
      season: 0,
      round: 0,
      raceName: raceId,
      circuitId: "",
      circuitName: "",
      circuitCountry: null,
      scheduledAt: "",
    };
  }
  const circuit = dataset.circuits.get(race.circuit_id);
  return {
    id: race.id,
    season: Number(race.season),
    round: Number(race.round),
    raceName: race.race_name,
    circuitId: race.circuit_id,
    circuitName: circuit?.name ?? race.circuit_id,
    circuitCountry: circuit?.country ?? null,
    scheduledAt: race.scheduled_at,
  };
}

function mapSupabaseRaceRef(
  raceId: string,
  raceMap: Map<string, SupabaseRaceRow>,
  circuitMap: Map<string, SupabaseCircuitRow>,
): CanonicalRaceRef {
  const race = raceMap.get(raceId);
  if (!race) {
    return {
      id: raceId,
      season: 0,
      round: 0,
      raceName: raceId,
      circuitId: "",
      circuitName: "",
      circuitCountry: null,
      scheduledAt: "",
    };
  }
  const circuit = circuitMap.get(race.circuit_id);
  return {
    id: race.id,
    season: race.season,
    round: race.round,
    raceName: race.race_name,
    circuitId: race.circuit_id,
    circuitName: circuit?.name ?? race.circuit_id,
    circuitCountry: circuit?.country ?? null,
    scheduledAt: race.scheduled_at,
  };
}

function buildConstructorOutlook(entries: UpcomingPredictionEntry[]) {
  return [...groupBy(entries, (entry) => entry.constructorId).entries()]
    .map(([constructorId, constructorEntries]) => ({
      constructorId,
      constructorName: constructorEntries[0]?.constructorName ?? constructorId,
      averageProjectedFinish: roundTo(
        constructorEntries.reduce((sum, entry) => sum + entry.projectedFinish, 0) / constructorEntries.length,
        2,
      ),
      averageWinnerProbability: roundTo(
        constructorEntries.reduce((sum, entry) => sum + entry.winnerProbability, 0) / constructorEntries.length,
        3,
      ),
      totalPodiumProbability: roundTo(
        constructorEntries.reduce((sum, entry) => sum + entry.podiumProbability, 0),
        3,
      ),
    }))
    .sort((left, right) => left.averageProjectedFinish - right.averageProjectedFinish);
}

function deriveCsvRaceWeekOverview(dataset: CsvPlatformDataset): RaceWeekOverview | null {
  const completedRaceIds = new Set(dataset.raceResults.map((row) => row.race_id));
  const now = Date.now();
  const latestCompletedRace = [...dataset.races]
    .filter((race) => new Date(race.scheduled_at).getTime() <= now && completedRaceIds.has(race.id))
    .sort((left, right) =>
      compareSeasonRoundDesc(
        { season: Number(left.season), round: Number(left.round) },
        { season: Number(right.season), round: Number(right.round) },
      ),
    )[0];
  const nextRace = [...dataset.races]
    .filter((race) => new Date(race.scheduled_at).getTime() > now)
    .sort((left, right) => new Date(left.scheduled_at).getTime() - new Date(right.scheduled_at).getTime())[0];

  const currentSeason = parseNumber(nextRace?.season) ?? parseNumber(latestCompletedRace?.season) ?? null;
  if (currentSeason === null) {
    return null;
  }

  return {
    currentSeason,
    latestCompletedRace: latestCompletedRace ? mapRaceRef(latestCompletedRace.id, dataset) : null,
    nextRace: nextRace ? mapRaceRef(nextRace.id, dataset) : null,
  };
}

function deriveSupabaseRaceRows(races: SupabaseRaceRow[], completedRaceIds: Set<string>) {
  const now = Date.now();
  const latestCompletedRaceRow = [...races]
    .filter((race) => new Date(race.scheduled_at).getTime() <= now && completedRaceIds.has(race.id))
    .sort((left, right) =>
      compareSeasonRoundDesc(
        { season: left.season, round: left.round },
        { season: right.season, round: right.round },
      ),
    )[0];
  const nextRaceRow = [...races]
    .filter((race) => new Date(race.scheduled_at).getTime() > now)
    .sort((left, right) => new Date(left.scheduled_at).getTime() - new Date(right.scheduled_at).getTime())[0];

  return { latestCompletedRaceRow, nextRaceRow };
}

function compareDriverStandingRows(left: CsvDriverStanding, right: CsvDriverStanding) {
  return (
    Number(right.points) - Number(left.points) ||
    Number(right.wins) - Number(left.wins) ||
    Number(left.standing_position) - Number(right.standing_position) ||
    left.driver_id.localeCompare(right.driver_id)
  );
}

function sortDriverStandingSnapshots(items: DriverStandingSnapshot[]) {
  return [...items].sort(
    (left, right) =>
      right.points - left.points ||
      right.wins - left.wins ||
      left.standingPosition - right.standingPosition ||
      left.driverId.localeCompare(right.driverId),
  );
}

function sortConstructorStandingSnapshots(items: ConstructorStandingSnapshot[]) {
  return [...items].sort(
    (left, right) =>
      right.points - left.points ||
      right.wins - left.wins ||
      left.standingPosition - right.standingPosition ||
      left.constructorId.localeCompare(right.constructorId),
  );
}
