import type { z } from "zod";
import { raceScenarioSchema } from "@/lib/api/validation";
import type { RaceContext, RaceContextEntrant } from "@/lib/server/race-context";

type RaceScenarioInput = z.infer<typeof raceScenarioSchema>;
type ConfidenceLabel = "high" | "medium" | "low";

type SimulatedEntrant = {
  driverId: string;
  fullName: string;
  constructorId: string;
  constructorName: string;
  qualifyingPosition: number;
  projectedFinish: number;
  projectedPoints: number;
  podiumProbability: number;
  confidence: ConfidenceLabel;
  undercutImpact: number;
  score: number;
  explanation: string[];
};

export type RaceSimulationResponse = {
  raceId: string;
  raceName: string;
  scenarioSummary: {
    selectedDrivers: number;
    weatherScenario: RaceScenarioInput["weatherScenario"];
    pitStopCount: number;
    safetyCarProbability: number;
    aggressionFactor: number;
  };
  confidence: ConfidenceLabel;
  confidenceReason: string;
  undercutNarrative: string;
  finishingOrder: SimulatedEntrant[];
};

const POINTS_BY_POSITION: Record<number, number> = {
  1: 25,
  2: 18,
  3: 15,
  4: 12,
  5: 10,
  6: 8,
  7: 6,
  8: 4,
  9: 2,
  10: 1,
};

const COMPOUND_SCORES: Record<string, number> = {
  soft: 9,
  medium: 7,
  hard: 5,
  intermediate: 6,
  wet: 6,
};

export function simulateRaceScenario(input: RaceScenarioInput, context: RaceContext): RaceSimulationResponse {
  const selectedEntrants = selectEntrants(context.entrants, input.driverIds);
  const qualifyingOverrideMap = new Map(input.qualifyingOverrides.map((item) => [item.driverId, item.position]));
  const tirePlanQuality = scoreTirePlan(input);
  const weatherAlignment = scoreWeatherAlignment(input);
  const undercutNarrative = buildUndercutNarrative(input);

  const finishingOrder = selectedEntrants
    .map((entrant) =>
      scoreEntrant({
        entrant,
        input,
        qualifyingOverrideMap,
        tirePlanQuality,
        weatherAlignment,
      }),
    )
    .sort((left, right) => right.score - left.score)
    .map((entrant, index, list) => {
      const projectedFinish = index + 1;
      const scoreGap = entrant.score - (list[Math.min(index + 1, list.length - 1)]?.score ?? entrant.score);

      return {
        ...entrant,
        projectedFinish,
        projectedPoints: POINTS_BY_POSITION[projectedFinish] ?? 0,
        podiumProbability: estimatePodiumProbability(index, entrant.score, list),
        confidence: confidenceLabel(scoreGap, input, context),
      };
    });

  return {
    raceId: context.race.id,
    raceName: context.race.raceName,
    scenarioSummary: {
      selectedDrivers: finishingOrder.length,
      weatherScenario: input.weatherScenario,
      pitStopCount: input.pitStopCount,
      safetyCarProbability: input.safetyCarProbability,
      aggressionFactor: input.aggressionFactor,
    },
    confidence: overallConfidence(input, context),
    confidenceReason: describeConfidence(input, context),
    undercutNarrative,
    finishingOrder,
  };
}

function selectEntrants(entrants: RaceContextEntrant[], driverIds: string[]) {
  const entrantMap = new Map(entrants.map((entrant) => [entrant.driverId, entrant]));
  return driverIds
    .map((driverId) => entrantMap.get(driverId))
    .filter((entrant): entrant is RaceContextEntrant => entrant !== undefined);
}

function scoreEntrant({
  entrant,
  input,
  qualifyingOverrideMap,
  tirePlanQuality,
  weatherAlignment,
}: {
  entrant: RaceContextEntrant;
  input: RaceScenarioInput;
  qualifyingOverrideMap: Map<string, number>;
  tirePlanQuality: number;
  weatherAlignment: number;
}) {
  const overriddenGrid = qualifyingOverrideMap.get(entrant.driverId);
  const gridPosition = overriddenGrid ?? entrant.gridPosition;
  const baselineFinishScore =
    entrant.baselineFinish !== null ? Math.max(0, 26 - entrant.baselineFinish) * 2.2 : 18;
  const gridScore = Math.max(0, 21 - gridPosition) * 3.4;
  const formScore = entrant.recentPointsAverage * 1.35;
  const overtakingScore = entrant.overtakeScore * 0.28;
  const reliabilityScore = (entrant.reliabilityScore + input.reliabilityBias) * 0.18;
  const aggressionScore = (input.aggressionFactor - 50) * (entrant.overtakeScore >= 55 ? 0.12 : 0.04);
  const teamFocusScore = input.constructorFocus.includes(entrant.constructorId) ? 3.2 : 0;
  const safetyCarScore =
    input.safetyCarProbability * ((entrant.overtakeScore - 50) * 0.11 + (21 - gridPosition) * 0.18);
  const pitWindowScore = scorePitWindow(input.pitStopCount, entrant);
  const undercutImpact = roundTo(
    pitWindowScore + safetyCarScore * 0.45 + (input.aggressionFactor - 50) * 0.08,
    2,
  );

  const score =
    baselineFinishScore +
    gridScore +
    formScore +
    overtakingScore +
    reliabilityScore +
    aggressionScore +
    teamFocusScore +
    safetyCarScore +
    pitWindowScore +
    tirePlanQuality +
    weatherAlignment;

  const explanation = [
    `${entrant.fullName} starts from P${gridPosition}, contributing a grid baseline of ${roundTo(gridScore, 1)}.`,
    `Recent form adds ${roundTo(formScore, 1)} points from an average of ${entrant.recentPointsAverage.toFixed(1)} prior-race points.`,
    `Overtaking and reliability profiles contribute ${roundTo(overtakingScore + reliabilityScore, 1)} combined scenario points.`,
    buildStrategyExplanation(input, entrant, undercutImpact),
  ];

  return {
    driverId: entrant.driverId,
    fullName: entrant.fullName,
    constructorId: entrant.constructorId,
    constructorName: entrant.constructorName,
    qualifyingPosition: gridPosition,
    undercutImpact,
    score: roundTo(score, 2),
    explanation,
  };
}

function scoreTirePlan(input: RaceScenarioInput) {
  const stintScore = input.tirePlan.reduce(
    (total, stint) => total + (COMPOUND_SCORES[stint.compound] ?? 5),
    0,
  );
  const averageCompoundScore = stintScore / input.tirePlan.length;
  const totalLaps = input.tirePlan.reduce((sum, stint) => sum + stint.laps, 0);
  const lengthPenalty = totalLaps > 70 ? -2 : totalLaps < 35 ? -1.5 : 0;
  const pitWindowAdjustment = input.pitStopCount === input.tirePlan.length - 1 ? 2.6 : -1.8;

  return roundTo(averageCompoundScore + pitWindowAdjustment + lengthPenalty, 2);
}

function scoreWeatherAlignment(input: RaceScenarioInput) {
  const includesWetCompound = input.tirePlan.some((stint) =>
    ["intermediate", "wet"].includes(stint.compound),
  );

  if (input.weatherScenario === "dry" && includesWetCompound) {
    return -6;
  }

  if (input.weatherScenario !== "dry" && !includesWetCompound) {
    return -4;
  }

  return input.weatherScenario === "dry" ? 2 : 1;
}

function scorePitWindow(pitStopCount: number, entrant: RaceContextEntrant) {
  if (pitStopCount === 2) {
    return 3 + (entrant.overtakeScore - 50) * 0.04;
  }

  if (pitStopCount === 1) {
    return entrant.reliabilityScore > 82 ? 1.8 : -0.8;
  }

  return -1 + (entrant.overtakeScore - 50) * 0.07;
}

function estimatePodiumProbability(index: number, score: number, entrants: Array<{ score: number }>) {
  if (entrants.length <= 3) {
    return roundTo(Math.max(35, 88 - index * 18), 1);
  }

  const maxScore = entrants[0]?.score ?? score;
  const minScore = entrants[entrants.length - 1]?.score ?? score;
  const normalized = maxScore === minScore ? 0.5 : (score - minScore) / (maxScore - minScore);
  const rankPenalty = index * 10;
  return roundTo(Math.max(6, Math.min(92, normalized * 78 + 14 - rankPenalty)), 1);
}

function confidenceLabel(
  scoreGap: number,
  input: RaceScenarioInput,
  context: RaceContext,
): ConfidenceLabel {
  if (scoreGap > 4.5 && input.weatherScenario === "dry" && context.race.round >= 6) {
    return "high";
  }

  if (input.weatherScenario !== "dry" || input.safetyCarProbability > 0.55) {
    return "low";
  }

  return "medium";
}

function overallConfidence(input: RaceScenarioInput, context: RaceContext): ConfidenceLabel {
  if (input.weatherScenario !== "dry" || input.safetyCarProbability > 0.6) {
    return "low";
  }

  if (context.race.round <= 3 || input.driverIds.length < 8) {
    return "medium";
  }

  return "high";
}

function describeConfidence(input: RaceScenarioInput, context: RaceContext) {
  if (input.weatherScenario !== "dry") {
    return "Confidence is lower because mixed or wet assumptions create larger strategy variance than this baseline model can explain.";
  }

  if (input.safetyCarProbability > 0.6) {
    return "Confidence is lower because a high safety-car assumption can rapidly reorder pit windows and track position.";
  }

  if (context.race.round <= 3) {
    return "Confidence is moderate because early-season races provide less prior form for calibration.";
  }

  if (input.driverIds.length < 8) {
    return "Confidence is moderate because the selected field is narrow, so race-traffic interactions are only partially represented.";
  }

  return "Confidence is strongest here because the scenario is dry, the field sample is broader, and the model can lean on stable grid and form signals.";
}

function buildUndercutNarrative(input: RaceScenarioInput) {
  if (input.pitStopCount >= 3) {
    return "This setup favors aggressive track-position swings. The simulator expects undercut attempts to matter more than stint stability.";
  }

  if (input.pitStopCount === 2) {
    return "This is the simulator sweet spot for balanced undercut pressure: pit timing matters without completely dominating outright pace.";
  }

  return "With only one planned stop, the simulator discounts undercut upside and leans more on clean air, tire preservation, and reliability.";
}

function buildStrategyExplanation(
  input: RaceScenarioInput,
  entrant: RaceContextEntrant,
  undercutImpact: number,
) {
  if (input.pitStopCount >= 3) {
    return `An aggressive multi-stop plan produces an undercut impact of ${undercutImpact.toFixed(1)} for ${entrant.fullName}, rewarding overtaking strength but carrying more variance.`;
  }

  if (input.weatherScenario !== "dry") {
    return `The ${input.weatherScenario} weather assumption raises variance, so ${entrant.fullName}'s reliability score of ${entrant.reliabilityScore.toFixed(0)} matters more than usual.`;
  }

  return `The chosen two-stop style is close to the model sweet spot, giving ${entrant.fullName} an undercut impact of ${undercutImpact.toFixed(1)} without overcommitting on pit risk.`;
}

function roundTo(value: number, digits: number) {
  return Number(value.toFixed(digits));
}
