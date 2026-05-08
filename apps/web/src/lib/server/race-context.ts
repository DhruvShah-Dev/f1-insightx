import { getSupabasePublicClient } from "@/lib/server/supabase";
import { getRuntimeData, resolveRuntimeSource, type RuntimeSourceResult } from "@/lib/server/runtime-source";
import { roundTo } from "@/lib/server/utils";
import { parseNumber, readCsvFile } from "@/lib/server/csv";
import type { Race } from "@/lib/server/reference-data";

export type RaceContextEntrant = {
  driverId: string;
  fullName: string;
  constructorId: string;
  constructorName: string;
  gridPosition: number;
  qualifyingPosition: number;
  baselineFinish: number | null;
  recentPointsAverage: number;
  overtakeScore: number;
  reliabilityScore: number;
};

export type RaceContext = {
  race: Race;
  entrants: RaceContextEntrant[];
};

export type RaceContextResult = RuntimeSourceResult<RaceContext>;

type CsvRaceResult = {
  race_id: string;
  driver_id: string;
  constructor_id: string;
  grid_position: string;
  finish_position: string;
  points: string;
};

type CsvQualifyingResult = {
  race_id: string;
  driver_id: string;
  constructor_id: string;
  position: string;
};

type CsvStrategyProfile = {
  race_id: string;
  driver_id: string;
  overtake_score: string;
  reliability_score: string;
};

type CsvModelFeature = {
  race_id: string;
  driver_id: string;
  constructor_id: string;
  recent_points_avg_3: string;
  overtake_score: string;
  reliability_score: string;
};

type CsvDriver = {
  id: string;
  full_name: string;
};

type CsvConstructor = {
  id: string;
  name: string;
};

type CsvRace = {
  id: string;
  season: string;
  round: string;
  race_name: string;
  official_name: string;
  circuit_id: string;
  scheduled_at: string;
  sprint_weekend: string;
};

type SupabaseRaceRow = {
  id: string;
  season: number;
  round: number;
  race_name: string;
  official_name: string | null;
  circuit_id: string;
  scheduled_at: string;
  sprint_weekend: boolean;
};

type SupabaseDriverRow = {
  id: string;
  full_name: string;
};

type SupabaseConstructorRow = {
  id: string;
  name: string;
};

type SupabaseQualifyingRow = {
  race_id: string;
  driver_id: string;
  constructor_id: string;
  position: number | null;
};

type SupabaseStrategyRow = {
  race_id: string;
  driver_id: string;
  overtake_score: number | null;
  reliability_score: number | null;
};

type SupabaseRaceResultRow = {
  race_id: string;
  driver_id: string;
  constructor_id: string;
  finish_position: number | null;
  points: number | null;
};

type SupabaseFeatureRow = {
  race_id: string;
  driver_id: string;
  constructor_id: string;
  recent_points_avg_3: number | null;
  overtake_score: number | null;
  reliability_score: number | null;
};

export async function getRaceContext(raceId: string): Promise<RaceContext | null> {
  const result = await getRaceContextResult(raceId);
  return getRuntimeData(result);
}

function describeRaceContext(context: RaceContext) {
  return {
    eventId: context.race.id,
    season: context.race.season,
    round: context.race.round,
  };
}

export async function getRaceContextResult(raceId: string): Promise<RaceContextResult> {
  return resolveRuntimeSource({
    surface: "reference",
    primary: {
      sourceKind: "database",
      sourceLabel: "canonical_tables",
      load: async () => {
        const supabase = getSupabasePublicClient();
        if (!supabase) {
          return null;
        }
        return getRaceContextFromSupabase(raceId);
      },
      describe: describeRaceContext,
    },
    degraded: {
      sourceKind: "csv-canonical",
      sourceLabel: "curated_csv",
      load: () => getRaceContextFromCsv(raceId),
      describe: describeRaceContext,
    },
  });
}

async function getRaceContextFromCsv(raceId: string): Promise<RaceContext | null> {
  const [races, drivers, constructors, qualifyingResults, raceResults, strategyProfiles, modelFeatures] =
    await Promise.all([
      readCsvFile<CsvRace>("curated.races"),
      readCsvFile<CsvDriver>("curated.drivers"),
      readCsvFile<CsvConstructor>("curated.constructors"),
      readCsvFile<CsvQualifyingResult>("curated.qualifyingResults"),
      readCsvFile<CsvRaceResult>("curated.raceResults"),
      readCsvFile<CsvStrategyProfile>("curated.strategyProfiles"),
      readCsvFile<CsvModelFeature>("curated.modelFeatures"),
    ]);

  const raceRow = races.find((row) => row.id === raceId);
  if (!raceRow) {
    return null;
  }

  const race = mapRace(raceRow);
  const driverMap = new Map(drivers.map((driver) => [driver.id, driver.full_name]));
  const constructorMap = new Map(constructors.map((constructor) => [constructor.id, constructor.name]));
  const strategyMap = new Map(
    strategyProfiles
      .filter((row) => row.race_id === raceId)
      .map((row) => [
        row.driver_id,
        {
          overtakeScore: parseNumber(row.overtake_score) ?? 50,
          reliabilityScore: parseNumber(row.reliability_score) ?? 75,
        },
      ]),
  );
  const featureMap = new Map(
    modelFeatures
      .filter((row) => row.race_id === raceId)
      .map((row) => [
        row.driver_id,
        {
          recentPointsAverage: parseNumber(row.recent_points_avg_3) ?? 0,
          overtakeScore: parseNumber(row.overtake_score) ?? 50,
          reliabilityScore: parseNumber(row.reliability_score) ?? 75,
        },
      ]),
  );

  const priorResults = raceResults.filter((row) => {
    if (!row.race_id.startsWith(`${race.season}-`)) {
      return false;
    }

    const rowRound = Number(row.race_id.split("-")[1]);
    return rowRound < race.round;
  });

  const entrantQualifying = qualifyingResults
    .filter((row) => row.race_id === raceId)
    .sort((left, right) => Number(left.position) - Number(right.position));

  const entrants = entrantQualifying.map((row) => {
    const driverPrior = priorResults.filter((result) => result.driver_id === row.driver_id);
    const averageFinish = average(
      driverPrior
        .map((result) => parseNumber(result.finish_position))
        .filter((value): value is number => value !== null),
    );
    const averagePoints = average(
      driverPrior.map((result) => Number(result.points)).filter((value) => !Number.isNaN(value)),
    );
    const strategy = strategyMap.get(row.driver_id);
    const feature = featureMap.get(row.driver_id);
    const qualifyingPosition = parseNumber(row.position) ?? 20;

    return {
      driverId: row.driver_id,
      fullName: driverMap.get(row.driver_id) ?? row.driver_id,
      constructorId: row.constructor_id,
      constructorName: constructorMap.get(row.constructor_id) ?? row.constructor_id,
      gridPosition: qualifyingPosition,
      qualifyingPosition,
      baselineFinish: averageFinish,
      recentPointsAverage: roundTo(feature?.recentPointsAverage ?? averagePoints ?? 0, 2),
      overtakeScore: feature?.overtakeScore ?? strategy?.overtakeScore ?? 50,
      reliabilityScore: feature?.reliabilityScore ?? strategy?.reliabilityScore ?? 75,
    };
  });

  return { race, entrants };
}

async function getRaceContextFromSupabase(raceId: string): Promise<RaceContext | null> {
  const supabase = getSupabasePublicClient();
  if (!supabase) {
    return null;
  }

  const { data: raceRow, error: raceError } = await supabase
    .from("races")
    .select("id, season, round, race_name, official_name, circuit_id, scheduled_at, sprint_weekend")
    .eq("id", raceId)
    .single();

  if (raceError || !raceRow) {
    return null;
  }

  const typedRaceRow = raceRow as SupabaseRaceRow;
  const race = {
    id: typedRaceRow.id,
    season: typedRaceRow.season,
    round: typedRaceRow.round,
    raceName: typedRaceRow.race_name,
    officialName: typedRaceRow.official_name,
    circuitId: typedRaceRow.circuit_id,
    scheduledAt: typedRaceRow.scheduled_at,
    sprintWeekend: typedRaceRow.sprint_weekend,
  };

  const [driversResult, constructorsResult, qualifyingResult, strategyResult, priorResultsResult, featuresResult] =
    await Promise.all([
      supabase.from("drivers").select("id, full_name"),
      supabase.from("constructors").select("id, name"),
      supabase
        .from("qualifying_results")
        .select("race_id, driver_id, constructor_id, position")
        .eq("race_id", raceId)
        .order("position"),
      supabase
        .from("strategy_profiles")
        .select("race_id, driver_id, overtake_score, reliability_score")
        .eq("race_id", raceId),
      supabase
        .from("race_results")
        .select("race_id, driver_id, constructor_id, finish_position, points")
        .like("race_id", `${race.season}-%`),
      supabase
        .from("model_features")
        .select("race_id, driver_id, constructor_id, recent_points_avg_3, overtake_score, reliability_score")
        .eq("race_id", raceId),
    ]);

  if (
    driversResult.error ||
    constructorsResult.error ||
    qualifyingResult.error ||
    strategyResult.error ||
    priorResultsResult.error ||
    featuresResult.error
  ) {
    throw new Error("Failed to build race context from Supabase.");
  }

  const driverRows = (driversResult.data ?? []) as SupabaseDriverRow[];
  const constructorRows = (constructorsResult.data ?? []) as SupabaseConstructorRow[];
  const strategyRows = (strategyResult.data ?? []) as SupabaseStrategyRow[];
  const featureRows = (featuresResult.data ?? []) as SupabaseFeatureRow[];
  const priorResultRows = (priorResultsResult.data ?? []) as SupabaseRaceResultRow[];
  const qualifyingRows = (qualifyingResult.data ?? []) as SupabaseQualifyingRow[];

  const driverMap = new Map(driverRows.map((driver) => [driver.id, driver.full_name]));
  const constructorMap = new Map(constructorRows.map((constructor) => [constructor.id, constructor.name]));
  const strategyMap = new Map(
    strategyRows.map((row) => [
      row.driver_id,
      {
        overtakeScore: row.overtake_score ?? 50,
        reliabilityScore: row.reliability_score ?? 75,
      },
    ]),
  );
  const featureMap = new Map(
    featureRows.map((row) => [
      row.driver_id,
      {
        recentPointsAverage: row.recent_points_avg_3 ?? 0,
        overtakeScore: row.overtake_score ?? 50,
        reliabilityScore: row.reliability_score ?? 75,
      },
    ]),
  );
  const priorResults = priorResultRows.filter((row) => {
    const rowRound = Number(String(row.race_id).split("-")[1]);
    return rowRound < race.round;
  });

  const entrants = qualifyingRows.map((row) => {
    const driverPrior = priorResults.filter((result) => result.driver_id === row.driver_id);
    const averageFinish = average(
      driverPrior
        .map((result) =>
          typeof result.finish_position === "number" ? result.finish_position : Number(result.finish_position),
        )
        .filter((value) => !Number.isNaN(value)),
    );
    const averagePoints = average(
      driverPrior
        .map((result) => (typeof result.points === "number" ? result.points : Number(result.points)))
        .filter((value) => !Number.isNaN(value)),
    );
    const strategy = strategyMap.get(row.driver_id);
    const feature = featureMap.get(row.driver_id);
    const qualifyingPosition = row.position ?? 20;

    return {
      driverId: row.driver_id,
      fullName: driverMap.get(row.driver_id) ?? row.driver_id,
      constructorId: row.constructor_id,
      constructorName: constructorMap.get(row.constructor_id) ?? row.constructor_id,
      gridPosition: qualifyingPosition,
      qualifyingPosition,
      baselineFinish: averageFinish,
      recentPointsAverage: roundTo(feature?.recentPointsAverage ?? averagePoints ?? 0, 2),
      overtakeScore: feature?.overtakeScore ?? strategy?.overtakeScore ?? 50,
      reliabilityScore: feature?.reliabilityScore ?? strategy?.reliabilityScore ?? 75,
    };
  });

  return { race, entrants };
}

function mapRace(row: CsvRace): Race {
  return {
    id: row.id,
    season: Number(row.season),
    round: Number(row.round),
    raceName: row.race_name,
    officialName: row.official_name || null,
    circuitId: row.circuit_id,
    scheduledAt: row.scheduled_at,
    sprintWeekend: row.sprint_weekend === "True" || row.sprint_weekend === "true",
  };
}

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
