import { getSupabaseAdminClient } from "@/lib/server/supabase";
import { parseNumber, readCuratedCsv } from "@/lib/server/csv";

export type FantasyDriverCandidate = {
  id: string;
  name: string;
  constructorId: string;
  constructorName: string;
  recentPoints: number;
  averageFinish: number;
  overtakeScore: number;
  reliabilityScore: number;
  price: number;
  projectedScore: number;
  valueScore: number;
  volatility: number;
};

export type FantasyConstructorCandidate = {
  id: string;
  name: string;
  recentPoints: number;
  averageFinish: number;
  reliabilityScore: number;
  price: number;
  projectedScore: number;
  valueScore: number;
  volatility: number;
};

export type FantasyDataset = {
  season: number;
  round: number | null;
  drivers: FantasyDriverCandidate[];
  constructors: FantasyConstructorCandidate[];
  pricingSource: string;
};

type CsvRaceResult = {
  race_id: string;
  driver_id: string;
  constructor_id: string;
  finish_position: string;
  points: string;
};

type CsvDriver = {
  id: string;
  full_name: string;
};

type CsvConstructor = {
  id: string;
  name: string;
};

type CsvStrategyProfile = {
  race_id: string;
  driver_id: string;
  overtake_score: string;
  reliability_score: string;
};

export async function getFantasyDataset(season: number, round?: number): Promise<FantasyDataset> {
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    return getFantasyDatasetFromSupabase(season, round);
  }

  return getFantasyDatasetFromCsv(season, round);
}

async function getFantasyDatasetFromCsv(season: number, round?: number): Promise<FantasyDataset> {
  const [drivers, constructors, raceResults, strategyProfiles] = await Promise.all([
    readCuratedCsv("drivers.csv") as Promise<CsvDriver[]>,
    readCuratedCsv("constructors.csv") as Promise<CsvConstructor[]>,
    readCuratedCsv("race_results.csv") as Promise<CsvRaceResult[]>,
    readCuratedCsv("strategy_profiles.csv") as Promise<CsvStrategyProfile[]>,
  ]);

  const targetRound = round ?? inferLatestRound(raceResults, season);
  const filteredResults = raceResults.filter((row) => {
    if (!row.race_id.startsWith(`${season}-`)) {
      return false;
    }

    const resultRound = Number(row.race_id.split("-")[1]);
    return resultRound <= targetRound;
  });

  const driversMap = new Map(drivers.map((driver) => [driver.id, driver.full_name]));
  const constructorsMap = new Map(constructors.map((constructor) => [constructor.id, constructor.name]));
  const latestStrategyByDriver = latestStrategyMap(strategyProfiles, season, targetRound);

  const driverCandidates = buildDriverCandidates(
    filteredResults,
    driversMap,
    constructorsMap,
    latestStrategyByDriver,
  );
  const constructorCandidates = buildConstructorCandidates(filteredResults, constructorsMap);

  return {
    season,
    round: targetRound,
    drivers: driverCandidates,
    constructors: constructorCandidates,
    pricingSource: "derived-historical-pricing",
  };
}

async function getFantasyDatasetFromSupabase(season: number, round?: number): Promise<FantasyDataset> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new Error("Supabase client unavailable.");
  }

  const [driversResult, constructorsResult, resultsResult, strategyResult] = await Promise.all([
    supabase.from("drivers").select("id, full_name"),
    supabase.from("constructors").select("id, name"),
    supabase.from("race_results").select("race_id, driver_id, constructor_id, finish_position, points"),
    supabase.from("strategy_profiles").select("race_id, driver_id, overtake_score, reliability_score"),
  ]);

  if (driversResult.error || constructorsResult.error || resultsResult.error || strategyResult.error) {
    throw new Error("Failed to load fantasy dataset from Supabase.");
  }

  const raceResults = (resultsResult.data ?? []).map((row) => ({
    race_id: String(row.race_id),
    driver_id: String(row.driver_id),
    constructor_id: String(row.constructor_id),
    finish_position: String(row.finish_position ?? ""),
    points: String(row.points ?? 0),
  }));
  const targetRound = round ?? inferLatestRound(raceResults, season);
  const filteredResults = raceResults.filter((row) => {
    if (!row.race_id.startsWith(`${season}-`)) {
      return false;
    }
    const resultRound = Number(row.race_id.split("-")[1]);
    return resultRound <= targetRound;
  });

  const driversMap = new Map((driversResult.data ?? []).map((driver) => [driver.id, driver.full_name]));
  const constructorsMap = new Map(
    (constructorsResult.data ?? []).map((constructor) => [constructor.id, constructor.name]),
  );
  const latestStrategyByDriver = latestStrategyMap(
    (strategyResult.data ?? []).map((row) => ({
      race_id: String(row.race_id),
      driver_id: String(row.driver_id),
      overtake_score: String(row.overtake_score ?? ""),
      reliability_score: String(row.reliability_score ?? ""),
    })),
    season,
    targetRound,
  );

  return {
    season,
    round: targetRound,
    drivers: buildDriverCandidates(filteredResults, driversMap, constructorsMap, latestStrategyByDriver),
    constructors: buildConstructorCandidates(filteredResults, constructorsMap),
    pricingSource: "derived-historical-pricing",
  };
}

function buildDriverCandidates(
  filteredResults: CsvRaceResult[],
  driversMap: Map<string, string>,
  constructorsMap: Map<string, string>,
  latestStrategyByDriver: Map<string, { overtakeScore: number; reliabilityScore: number }>,
) {
  const grouped = new Map<string, CsvRaceResult[]>();
  filteredResults.forEach((row) => {
    const current = grouped.get(row.driver_id) ?? [];
    current.push(row);
    grouped.set(row.driver_id, current);
  });

  return [...grouped.entries()]
    .map(([driverId, results]) => {
      const recentPoints = average(results.map((row) => Number(row.points)).filter((value) => !Number.isNaN(value)));
      const averageFinish = average(
        results.map((row) => parseNumber(row.finish_position)).filter((value): value is number => value !== null),
      );
      const volatility = standardDeviation(
        results.map((row) => Number(row.points)).filter((value) => !Number.isNaN(value)),
      );
      const latest = results[results.length - 1];
      const strategy = latestStrategyByDriver.get(driverId) ?? { overtakeScore: 50, reliabilityScore: 75 };
      const projectedScore =
        recentPoints * 0.62 +
        Math.max(0, 22 - averageFinish) * 0.95 +
        strategy.overtakeScore * 0.07 +
        strategy.reliabilityScore * 0.06;
      const price = roundTo(8 + projectedScore * 0.52 + volatility * 0.18, 1);
      const valueScore = roundTo(projectedScore / price, 3);

      return {
        id: driverId,
        name: driversMap.get(driverId) ?? driverId,
        constructorId: latest.constructor_id,
        constructorName: constructorsMap.get(latest.constructor_id) ?? latest.constructor_id,
        recentPoints: roundTo(recentPoints, 2),
        averageFinish: roundTo(averageFinish, 2),
        overtakeScore: strategy.overtakeScore,
        reliabilityScore: strategy.reliabilityScore,
        price,
        projectedScore: roundTo(projectedScore, 2),
        valueScore,
        volatility: roundTo(volatility, 2),
      };
    })
    .sort((left, right) => right.projectedScore - left.projectedScore);
}

function buildConstructorCandidates(
  filteredResults: CsvRaceResult[],
  constructorsMap: Map<string, string>,
) {
  const grouped = new Map<string, CsvRaceResult[]>();
  filteredResults.forEach((row) => {
    const current = grouped.get(row.constructor_id) ?? [];
    current.push(row);
    grouped.set(row.constructor_id, current);
  });

  return [...grouped.entries()]
    .map(([constructorId, results]) => {
      const recentPoints = average(results.map((row) => Number(row.points)).filter((value) => !Number.isNaN(value)));
      const averageFinish = average(
        results.map((row) => parseNumber(row.finish_position)).filter((value): value is number => value !== null),
      );
      const volatility = standardDeviation(
        results.map((row) => Number(row.points)).filter((value) => !Number.isNaN(value)),
      );
      const reliabilityScore = Math.max(20, 100 - volatility * 7);
      const projectedScore =
        recentPoints * 0.8 + Math.max(0, 18 - averageFinish) * 0.75 + reliabilityScore * 0.08;
      const price = roundTo(10 + projectedScore * 0.48 + volatility * 0.14, 1);

      return {
        id: constructorId,
        name: constructorsMap.get(constructorId) ?? constructorId,
        recentPoints: roundTo(recentPoints, 2),
        averageFinish: roundTo(averageFinish, 2),
        reliabilityScore: roundTo(reliabilityScore, 2),
        price,
        projectedScore: roundTo(projectedScore, 2),
        valueScore: roundTo(projectedScore / price, 3),
        volatility: roundTo(volatility, 2),
      };
    })
    .sort((left, right) => right.projectedScore - left.projectedScore);
}

function inferLatestRound(results: CsvRaceResult[], season: number) {
  return results
    .filter((row) => row.race_id.startsWith(`${season}-`))
    .reduce((latest, row) => Math.max(latest, Number(row.race_id.split("-")[1])), 1);
}

function latestStrategyMap(
  strategyProfiles: CsvStrategyProfile[],
  season: number,
  targetRound: number,
) {
  const latest = new Map<string, { round: number; overtakeScore: number; reliabilityScore: number }>();

  strategyProfiles.forEach((row) => {
    if (!row.race_id.startsWith(`${season}-`)) {
      return;
    }
    const round = Number(row.race_id.split("-")[1]);
    if (round > targetRound) {
      return;
    }
    const current = latest.get(row.driver_id);
    if (!current || round >= current.round) {
      latest.set(row.driver_id, {
        round,
        overtakeScore: parseNumber(row.overtake_score) ?? 50,
        reliabilityScore: parseNumber(row.reliability_score) ?? 75,
      });
    }
  });

  return new Map(
    [...latest.entries()].map(([driverId, item]) => [
      driverId,
      { overtakeScore: item.overtakeScore, reliabilityScore: item.reliabilityScore },
    ]),
  );
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]) {
  if (values.length <= 1) {
    return 0;
  }
  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

function roundTo(value: number, digits: number) {
  return Number(value.toFixed(digits));
}
