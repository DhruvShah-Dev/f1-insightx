import type { z } from "zod";
import { fantasyRequestSchema } from "@/lib/api/validation";
import type {
  FantasyConstructorCandidate,
  FantasyDataset,
  FantasyDriverCandidate,
} from "@/lib/server/fantasy-data";

type FantasyInput = z.infer<typeof fantasyRequestSchema>;
type RiskProfile = FantasyInput["riskProfile"];
type ScoringFocus = FantasyInput["scoringFocus"];

type Lineup = {
  style: RiskProfile;
  drivers: FantasyDriverCandidate[];
  constructors: FantasyConstructorCandidate[];
  captainId: string;
  totalPrice: number;
  expectedScore: number;
  rationale: string[];
};

export type FantasyRecommendationResponse = {
  season: number;
  round: number | null;
  pricingSource: string;
  budget: number;
  primaryStyle: RiskProfile;
  primary: Lineup;
  alternatives: Lineup[];
};

export function optimizeFantasyLineups(
  input: FantasyInput,
  dataset: FantasyDataset,
): FantasyRecommendationResponse {
  const styles: RiskProfile[] = ["safe", "balanced", "aggressive"];
  const lineups = styles.map((style) => buildBestLineup(style, input, dataset)).filter(Boolean) as Lineup[];
  if (lineups.length === 0) {
    const minimumBudget = estimateMinimumBudget(dataset);
    throw new Error(
      `No valid lineup fits the current constraints. Increase budget or relax preferences. Minimum viable budget is about ${minimumBudget}.`,
    );
  }

  const primary = lineups.find((lineup) => lineup.style === input.riskProfile) ?? lineups[0];
  const alternatives = lineups.filter((lineup) => lineup.style !== primary.style);

  return {
    season: dataset.season,
    round: dataset.round,
    pricingSource: dataset.pricingSource,
    budget: input.budget,
    primaryStyle: primary.style,
    primary,
    alternatives,
  };
}

function buildBestLineup(style: RiskProfile, input: FantasyInput, dataset: FantasyDataset): Lineup | null {
  const excluded = new Set(input.excludedIds);
  const driverPool = dataset.drivers.filter((driver) => !excluded.has(driver.id));
  const constructorPool = dataset.constructors.filter((constructor) => !excluded.has(constructor.id));

  let best:
    | {
        drivers: FantasyDriverCandidate[];
        constructors: FantasyConstructorCandidate[];
        totalPrice: number;
        expectedScore: number;
      }
    | null = null;

  const driverCombos = combinations(driverPool, 5);
  const constructorCombos = combinations(constructorPool, 2);

  for (const drivers of driverCombos) {
    if (!containsRequiredDrivers(drivers, input.preferredDriverIds)) {
      continue;
    }

    const driversPrice = sum(drivers.map((driver) => driver.price));
    if (driversPrice > input.budget) {
      continue;
    }

    for (const constructors of constructorCombos) {
      if (!containsRequiredConstructors(constructors, input.preferredConstructorIds)) {
        continue;
      }

      const totalPrice = roundTo(driversPrice + sum(constructors.map((constructor) => constructor.price)), 1);
      if (totalPrice > input.budget) {
        continue;
      }

      const driverScore = drivers.reduce(
        (total, driver) => total + scoreDriverForLineup(driver, style, input.scoringFocus),
        0,
      );
      const constructorScore = constructors.reduce(
        (total, constructor) => total + scoreConstructorForLineup(constructor, style, input.scoringFocus),
        0,
      );
      const captain = chooseCaptain(drivers, style, input.lockCaptain);
      const captainBonus = captain.projectedScore;
      const expectedScore = roundTo(driverScore + constructorScore + captainBonus, 2);

      if (!best || expectedScore > best.expectedScore) {
        best = {
          drivers,
          constructors,
          totalPrice,
          expectedScore,
        };
      }
    }
  }

  if (!best) {
    return null;
  }

  const captain = chooseCaptain(best.drivers, style, input.lockCaptain);
  return {
    style,
    drivers: best.drivers,
    constructors: best.constructors,
    captainId: captain.id,
    totalPrice: best.totalPrice,
    expectedScore: best.expectedScore,
    rationale: buildRationale(best.drivers, best.constructors, captain, style, input.scoringFocus),
  };
}

function scoreDriverForLineup(
  driver: FantasyDriverCandidate,
  style: RiskProfile,
  scoringFocus: ScoringFocus,
) {
  const base =
    scoringFocus === "points"
      ? driver.projectedScore
      : scoringFocus === "value"
        ? driver.valueScore * 24
        : driver.overtakeScore * 0.22 + driver.volatility * 1.8 + driver.projectedScore * 0.4;

  if (style === "safe") {
    return base + driver.reliabilityScore * 0.12 - driver.volatility * 0.9;
  }

  if (style === "aggressive") {
    return base + driver.volatility * 1.15 + driver.overtakeScore * 0.16;
  }

  return base + driver.reliabilityScore * 0.05 + driver.valueScore * 6;
}

function scoreConstructorForLineup(
  constructor: FantasyConstructorCandidate,
  style: RiskProfile,
  scoringFocus: ScoringFocus,
) {
  const base =
    scoringFocus === "points"
      ? constructor.projectedScore
      : scoringFocus === "value"
        ? constructor.valueScore * 26
        : constructor.volatility * 1.3 + constructor.projectedScore * 0.55;

  if (style === "safe") {
    return base + constructor.reliabilityScore * 0.16 - constructor.volatility * 0.85;
  }

  if (style === "aggressive") {
    return base + constructor.volatility * 1.2;
  }

  return base + constructor.valueScore * 7;
}

function chooseCaptain(
  drivers: FantasyDriverCandidate[],
  style: RiskProfile,
  lockCaptain: boolean,
) {
  if (lockCaptain) {
    return [...drivers].sort((left, right) => right.projectedScore - left.projectedScore)[0];
  }

  if (style === "aggressive") {
    return [...drivers].sort(
      (left, right) =>
        right.projectedScore + right.volatility - (left.projectedScore + left.volatility),
    )[0];
  }

  return [...drivers].sort(
    (left, right) =>
      right.projectedScore + right.reliabilityScore * 0.1 - (left.projectedScore + left.reliabilityScore * 0.1),
  )[0];
}

function buildRationale(
  drivers: FantasyDriverCandidate[],
  constructors: FantasyConstructorCandidate[],
  captain: FantasyDriverCandidate,
  style: RiskProfile,
  scoringFocus: ScoringFocus,
) {
  const topValue = [...drivers].sort((left, right) => right.valueScore - left.valueScore)[0];
  const safest = [...drivers].sort((left, right) => right.reliabilityScore - left.reliabilityScore)[0];
  const leadConstructor = [...constructors].sort(
    (left, right) => right.projectedScore - left.projectedScore,
  )[0];

  return [
    `${captain.name} is the captain because the ${style} build leans on the strongest multiplier profile in the lineup.`,
    `${topValue.name} is the best value driver in this lineup at ${topValue.valueScore.toFixed(3)} score-per-price.`,
    `${safest.name} provides the highest reliability buffer among the selected drivers.`,
    `${leadConstructor.name} anchors the constructor side with a projected score of ${leadConstructor.projectedScore.toFixed(1)}.`,
    `This lineup is optimized for ${scoringFocus} within a ${style} risk profile, not official live fantasy pricing.`,
  ];
}

function containsRequiredDrivers(drivers: FantasyDriverCandidate[], requiredIds: string[]) {
  return requiredIds.every((driverId) => drivers.some((driver) => driver.id === driverId));
}

function containsRequiredConstructors(
  constructors: FantasyConstructorCandidate[],
  requiredIds: string[],
) {
  return requiredIds.every((constructorId) =>
    constructors.some((constructor) => constructor.id === constructorId),
  );
}

function combinations<T>(items: T[], size: number): T[][] {
  if (size === 0) {
    return [[]];
  }
  if (items.length < size) {
    return [];
  }

  const result: T[][] = [];
  for (let index = 0; index <= items.length - size; index += 1) {
    const head = items[index];
    const tails = combinations(items.slice(index + 1), size - 1);
    tails.forEach((tail) => result.push([head, ...tail]));
  }
  return result;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function roundTo(value: number, digits: number) {
  return Number(value.toFixed(digits));
}

function estimateMinimumBudget(dataset: FantasyDataset) {
  const cheapestDrivers = [...dataset.drivers]
    .sort((left, right) => left.price - right.price)
    .slice(0, 5);
  const cheapestConstructors = [...dataset.constructors]
    .sort((left, right) => left.price - right.price)
    .slice(0, 2);

  return roundTo(
    sum(cheapestDrivers.map((driver) => driver.price)) +
      sum(cheapestConstructors.map((constructor) => constructor.price)),
    1,
  );
}
