import { readCsvFile } from "@/lib/server/csv";
import { getFantasyInputsForCurrentRaceWeek, getRaceWeekOverview } from "@/lib/server/f1-platform";
import { roundTo } from "@/lib/server/utils";

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

type CsvDriver = {
  id: string;
  full_name: string;
};

type CsvConstructor = {
  id: string;
  name: string;
};

export async function getFantasyDataset(season?: number, round?: number): Promise<FantasyDataset> {
  const overview = await getRaceWeekOverview();
  const targetSeason = season ?? overview?.nextRace?.season ?? overview?.latestCompletedRace?.season;
  const targetRound = round ?? overview?.nextRace?.round ?? null;

  if (!targetSeason) {
    return {
      season: new Date().getUTCFullYear(),
      round: null,
      drivers: [],
      constructors: [],
      pricingSource: "prediction_fantasy_inputs_v1",
    };
  }

  const [inputs, drivers, constructors] = await Promise.all([
    getFantasyInputsForCurrentRaceWeek(targetSeason, targetRound ?? undefined),
    readCsvFile<CsvDriver>("curated.drivers"),
    readCsvFile<CsvConstructor>("curated.constructors"),
  ]);

  const driverMap = new Map(drivers.map((driver) => [driver.id, driver.full_name]));
  const constructorMap = new Map(constructors.map((constructor) => [constructor.id, constructor.name]));

  const driverCandidates = inputs
    .filter((row) => row.entityType === "driver")
    .map((row) => ({
      id: row.entityId,
      name: driverMap.get(row.entityId) ?? row.entityId,
      constructorId: row.constructorId ?? "",
      constructorName: constructorMap.get(row.constructorId ?? "") ?? row.constructorId ?? "",
      recentPoints: roundTo(row.projectedScore * 0.42, 2),
      averageFinish: roundTo(11 - row.top10Probability / 12, 2),
      overtakeScore: roundTo(row.top10Probability, 2),
      reliabilityScore: roundTo(100 - row.volatilityProxy, 2),
      price: row.priceEstimate,
      projectedScore: roundTo(row.projectedScore, 2),
      valueScore: roundTo(row.valueScore, 3),
      volatility: roundTo(row.volatilityProxy, 2),
    }))
    .sort((left, right) => right.projectedScore - left.projectedScore);

  const constructorCandidates = inputs
    .filter((row) => row.entityType === "constructor")
    .map((row) => ({
      id: row.entityId,
      name: constructorMap.get(row.entityId) ?? row.entityId,
      recentPoints: roundTo(row.projectedScore * 0.56, 2),
      averageFinish: roundTo(10 - row.top10Probability / 14, 2),
      reliabilityScore: roundTo(100 - row.volatilityProxy, 2),
      price: row.priceEstimate,
      projectedScore: roundTo(row.projectedScore, 2),
      valueScore: roundTo(row.valueScore, 3),
      volatility: roundTo(row.volatilityProxy, 2),
    }))
    .sort((left, right) => right.projectedScore - left.projectedScore);

  return {
    season: targetSeason,
    round: targetRound,
    drivers: driverCandidates,
    constructors: constructorCandidates,
    pricingSource: "prediction_fantasy_inputs_v1",
  };
}
