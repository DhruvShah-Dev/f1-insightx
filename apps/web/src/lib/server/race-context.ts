import { getSupabaseAdminClient } from "@/lib/server/supabase";
import { parseNumber, readCuratedCsv } from "@/lib/server/csv";
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

export async function getRaceContext(raceId: string): Promise<RaceContext | null> {
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    return getRaceContextFromSupabase(raceId);
  }

  return getRaceContextFromCsv(raceId);
}

async function getRaceContextFromCsv(raceId: string): Promise<RaceContext | null> {
  const [races, drivers, constructors, qualifyingResults, raceResults, strategyProfiles] =
    await Promise.all([
      readCuratedCsv("races.csv") as Promise<CsvRace[]>,
      readCuratedCsv("drivers.csv") as Promise<CsvDriver[]>,
      readCuratedCsv("constructors.csv") as Promise<CsvConstructor[]>,
      readCuratedCsv("qualifying_results.csv") as Promise<CsvQualifyingResult[]>,
      readCuratedCsv("race_results.csv") as Promise<CsvRaceResult[]>,
      readCuratedCsv("strategy_profiles.csv") as Promise<CsvStrategyProfile[]>,
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
    const qualifyingPosition = parseNumber(row.position) ?? 20;

    return {
      driverId: row.driver_id,
      fullName: driverMap.get(row.driver_id) ?? row.driver_id,
      constructorId: row.constructor_id,
      constructorName: constructorMap.get(row.constructor_id) ?? row.constructor_id,
      gridPosition: qualifyingPosition,
      qualifyingPosition,
      baselineFinish: averageFinish,
      recentPointsAverage: roundTo(averagePoints ?? 0, 2),
      overtakeScore: strategy?.overtakeScore ?? 50,
      reliabilityScore: strategy?.reliabilityScore ?? 75,
    };
  });

  return { race, entrants };
}

async function getRaceContextFromSupabase(raceId: string): Promise<RaceContext | null> {
  const supabase = getSupabaseAdminClient();
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

  const race = {
    id: raceRow.id,
    season: raceRow.season,
    round: raceRow.round,
    raceName: raceRow.race_name,
    officialName: raceRow.official_name,
    circuitId: raceRow.circuit_id,
    scheduledAt: raceRow.scheduled_at,
    sprintWeekend: raceRow.sprint_weekend,
  };

  const [driversResult, constructorsResult, qualifyingResult, strategyResult, priorResultsResult] =
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
    ]);

  if (
    driversResult.error ||
    constructorsResult.error ||
    qualifyingResult.error ||
    strategyResult.error ||
    priorResultsResult.error
  ) {
    throw new Error("Failed to build race context from Supabase.");
  }

  const driverMap = new Map((driversResult.data ?? []).map((driver) => [driver.id, driver.full_name]));
  const constructorMap = new Map(
    (constructorsResult.data ?? []).map((constructor) => [constructor.id, constructor.name]),
  );
  const strategyMap = new Map(
    (strategyResult.data ?? []).map((row) => [
      row.driver_id,
      {
        overtakeScore: row.overtake_score ?? 50,
        reliabilityScore: row.reliability_score ?? 75,
      },
    ]),
  );
  const priorResults = (priorResultsResult.data ?? []).filter((row) => {
    const rowRound = Number(String(row.race_id).split("-")[1]);
    return rowRound < race.round;
  });

  const entrants = (qualifyingResult.data ?? []).map((row) => {
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
    const qualifyingPosition = row.position ?? 20;

    return {
      driverId: row.driver_id,
      fullName: driverMap.get(row.driver_id) ?? row.driver_id,
      constructorId: row.constructor_id,
      constructorName: constructorMap.get(row.constructor_id) ?? row.constructor_id,
      gridPosition: qualifyingPosition,
      qualifyingPosition,
      baselineFinish: averageFinish,
      recentPointsAverage: roundTo(averagePoints ?? 0, 2),
      overtakeScore: strategy?.overtakeScore ?? 50,
      reliabilityScore: strategy?.reliabilityScore ?? 75,
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

function roundTo(value: number, digits: number) {
  return Number(value.toFixed(digits));
}
