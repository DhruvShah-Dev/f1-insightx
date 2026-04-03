import type { z } from "zod";
import { raceScenarioSchema } from "@/lib/api/validation";
import type { RaceContext, RaceContextEntrant } from "@/lib/server/race-context";
import { roundTo } from "@/lib/server/utils";

type RaceScenarioInput = z.infer<typeof raceScenarioSchema>;
type ConfidenceLabel = "high" | "medium" | "low";
type ComparisonTargetType = NonNullable<RaceScenarioInput["comparisonTargetType"]>;

type ComparisonTarget = {
  type: ComparisonTargetType;
  id: string;
  label: string;
  entrantIds: string[];
};

type StrategyProfile = {
  pitStopCount: number;
  tirePlan: RaceScenarioInput["tirePlan"];
  safetyCarProbability: number;
  weatherScenario: RaceScenarioInput["weatherScenario"];
  aggressionFactor: number;
  reliabilityBias: number;
  constructorFocus: string[];
};

type ScoredEntrant = {
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

type TargetOutcomeEntrant = {
  driverId: string;
  fullName: string;
  constructorId: string;
  constructorName: string;
  qualifyingPosition: number;
  baselineFinish: number;
  projectedFinish: number;
  finishDelta: number;
  baselinePoints: number;
  projectedPoints: number;
  pointsDelta: number;
  podiumProbability: number;
  undercutImpact: number;
  confidence: ConfidenceLabel;
  explanationSummary: string;
};

export type RaceSimulationResponse = {
  raceId: string;
  raceName: string;
  comparisonTarget: {
    type: ComparisonTargetType;
    id: string;
    label: string;
    entrantCount: number;
  } | null;
  scenarioSummary: {
    fieldSize: number;
    selectedDrivers: number;
    weatherScenario: RaceScenarioInput["weatherScenario"];
    pitStopCount: number;
    safetyCarProbability: number;
    aggressionFactor: number;
    baselineMode: string;
  };
  confidence: ConfidenceLabel;
  confidenceReason: string;
  undercutNarrative: string;
  targetSummary: {
    title: string;
    narrative: string;
    averageFinishDelta: number;
    aggregatePointsDelta: number;
    entrants: TargetOutcomeEntrant[];
  } | null;
  finishingOrder: Array<
    ScoredEntrant & {
      baselineFinish: number;
      finishDelta: number;
      baselinePoints: number;
      pointsDelta: number;
      isTarget: boolean;
    }
  >;
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

const BASELINE_PROFILE: StrategyProfile = {
  pitStopCount: 2,
  tirePlan: [
    { compound: "medium", laps: 18 },
    { compound: "hard", laps: 24 },
    { compound: "soft", laps: 15 },
  ],
  safetyCarProbability: 0.35,
  weatherScenario: "dry",
  aggressionFactor: 50,
  reliabilityBias: 0,
  constructorFocus: [],
};

export function simulateRaceScenario(input: RaceScenarioInput, context: RaceContext): RaceSimulationResponse {
  const selectedEntrants = selectEntrants(context.entrants, input.driverIds);
  const qualifyingOverrideMap = new Map(input.qualifyingOverrides.map((item) => [item.driverId, item.position]));
  const target = resolveComparisonTarget(input, selectedEntrants);
  const baselineField = simulateField({
    entrants: selectedEntrants,
    qualifyingOverrideMap,
    context,
    input,
    target,
    mode: "baseline",
  });
  const comparisonField = simulateField({
    entrants: selectedEntrants,
    qualifyingOverrideMap,
    context,
    input,
    target,
    mode: "comparison",
  });
  const baselineMap = new Map(baselineField.map((entrant) => [entrant.driverId, entrant]));
  const undercutNarrative = buildUndercutNarrative(input, target);

  const finishingOrder = comparisonField.map((entrant) => {
    const baseline = baselineMap.get(entrant.driverId) ?? entrant;
    return {
      ...entrant,
      baselineFinish: baseline.projectedFinish,
      finishDelta: baseline.projectedFinish - entrant.projectedFinish,
      baselinePoints: baseline.projectedPoints,
      pointsDelta: entrant.projectedPoints - baseline.projectedPoints,
      isTarget: target?.entrantIds.includes(entrant.driverId) ?? false,
    };
  });

  return {
    raceId: context.race.id,
    raceName: context.race.raceName,
    comparisonTarget: target
      ? {
          type: target.type,
          id: target.id,
          label: target.label,
          entrantCount: target.entrantIds.length,
        }
      : null,
    scenarioSummary: {
      fieldSize: comparisonField.length,
      selectedDrivers: comparisonField.length,
      weatherScenario: input.weatherScenario,
      pitStopCount: input.pitStopCount,
      safetyCarProbability: input.safetyCarProbability,
      aggressionFactor: input.aggressionFactor,
      baselineMode: "Everyone else uses the default race profile.",
    },
    confidence: overallConfidence(input, context),
    confidenceReason: describeConfidence(input, context, target),
    undercutNarrative,
    targetSummary: buildTargetSummary(finishingOrder, target),
    finishingOrder,
  };
}

function resolveComparisonTarget(
  input: RaceScenarioInput,
  entrants: RaceContextEntrant[],
): ComparisonTarget | null {
  if (input.comparisonTargetType === "driver" && input.comparisonTargetId) {
    const entrant = entrants.find((candidate) => candidate.driverId === input.comparisonTargetId);
    if (!entrant) {
      return null;
    }

    return {
      type: "driver",
      id: entrant.driverId,
      label: entrant.fullName,
      entrantIds: [entrant.driverId],
    };
  }

  if (input.comparisonTargetType === "constructor" && input.comparisonTargetId) {
    const constructorEntrants = entrants.filter(
      (candidate) => candidate.constructorId === input.comparisonTargetId,
    );
    if (constructorEntrants.length === 0) {
      return null;
    }

    return {
      type: "constructor",
      id: input.comparisonTargetId,
      label: constructorEntrants[0]?.constructorName ?? input.comparisonTargetId,
      entrantIds: constructorEntrants.map((entrant) => entrant.driverId),
    };
  }

  if (input.constructorFocus.length === 1) {
    const constructorEntrants = entrants.filter(
      (candidate) => candidate.constructorId === input.constructorFocus[0],
    );
    if (constructorEntrants.length > 0) {
      return {
        type: "constructor",
        id: input.constructorFocus[0],
        label: constructorEntrants[0]?.constructorName ?? input.constructorFocus[0],
        entrantIds: constructorEntrants.map((entrant) => entrant.driverId),
      };
    }
  }

  if (input.driverIds.length === 1) {
    const entrant = entrants.find((candidate) => candidate.driverId === input.driverIds[0]);
    if (entrant) {
      return {
        type: "driver",
        id: entrant.driverId,
        label: entrant.fullName,
        entrantIds: [entrant.driverId],
      };
    }
  }

  return null;
}

function simulateField({
  entrants,
  qualifyingOverrideMap,
  context,
  input,
  target,
  mode,
}: {
  entrants: RaceContextEntrant[];
  qualifyingOverrideMap: Map<string, number>;
  context: RaceContext;
  input: RaceScenarioInput;
  target: ComparisonTarget | null;
  mode: "baseline" | "comparison";
}) {
  return entrants
    .map((entrant) =>
      scoreEntrant({
        entrant,
        context,
        qualifyingOverrideMap,
        strategy:
          mode === "comparison" && isTargetEntrant(entrant.driverId, target)
            ? buildTargetProfile(input)
            : buildBaselineProfile(input),
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
}

function buildTargetProfile(input: RaceScenarioInput): StrategyProfile {
  return {
    pitStopCount: input.pitStopCount,
    tirePlan: input.tirePlan,
    safetyCarProbability: input.safetyCarProbability,
    weatherScenario: input.weatherScenario,
    aggressionFactor: input.aggressionFactor,
    reliabilityBias: input.reliabilityBias,
    constructorFocus: input.constructorFocus,
  };
}

function buildBaselineProfile(input: RaceScenarioInput): StrategyProfile {
  return {
    ...BASELINE_PROFILE,
    safetyCarProbability: input.safetyCarProbability,
    weatherScenario: input.weatherScenario,
  };
}

function isTargetEntrant(driverId: string, target: ComparisonTarget | null) {
  return target?.entrantIds.includes(driverId) ?? false;
}

function selectEntrants(entrants: RaceContextEntrant[], driverIds: string[]) {
  const entrantMap = new Map(entrants.map((entrant) => [entrant.driverId, entrant]));
  return driverIds
    .map((driverId) => entrantMap.get(driverId))
    .filter((entrant): entrant is RaceContextEntrant => entrant !== undefined);
}

function scoreEntrant({
  entrant,
  context,
  qualifyingOverrideMap,
  strategy,
}: {
  entrant: RaceContextEntrant;
  context: RaceContext;
  qualifyingOverrideMap: Map<string, number>;
  strategy: StrategyProfile;
}) {
  const overriddenGrid = qualifyingOverrideMap.get(entrant.driverId);
  const gridPosition = overriddenGrid ?? entrant.gridPosition;
  const baselineFinishScore =
    entrant.baselineFinish !== null ? Math.max(0, 26 - entrant.baselineFinish) * 2.2 : 18;
  const gridScore = Math.max(0, 21 - gridPosition) * 3.4;
  const formScore = entrant.recentPointsAverage * 1.35;
  const overtakingScore = entrant.overtakeScore * 0.28;
  const reliabilityScore = (entrant.reliabilityScore + strategy.reliabilityBias) * 0.18;
  const aggressionScore =
    (strategy.aggressionFactor - 50) * (entrant.overtakeScore >= 55 ? 0.12 : 0.04);
  const teamFocusScore = strategy.constructorFocus.includes(entrant.constructorId) ? 3.2 : 0;
  const safetyCarScore =
    strategy.safetyCarProbability *
    ((entrant.overtakeScore - 50) * 0.11 + (21 - gridPosition) * 0.18);
  const pitWindowScore = scorePitWindow(strategy.pitStopCount, entrant);
  const tirePlanQuality = scoreTirePlan(strategy.tirePlan, strategy.pitStopCount);
  const weatherAlignment = scoreWeatherAlignment(strategy.weatherScenario, strategy.tirePlan);
  const undercutImpact = roundTo(
    pitWindowScore + safetyCarScore * 0.45 + (strategy.aggressionFactor - 50) * 0.08,
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
    `Recent form adds ${roundTo(formScore, 1)} from an average of ${entrant.recentPointsAverage.toFixed(1)} prior-race points.`,
    `Overtaking and reliability profiles contribute ${roundTo(overtakingScore + reliabilityScore, 1)} combined scenario points.`,
    buildStrategyExplanation(strategy, entrant, undercutImpact, context.race.round),
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

function scoreTirePlan(tirePlan: RaceScenarioInput["tirePlan"], pitStopCount: number) {
  const stintScore = tirePlan.reduce((total, stint) => total + (COMPOUND_SCORES[stint.compound] ?? 5), 0);
  const averageCompoundScore = stintScore / tirePlan.length;
  const totalLaps = tirePlan.reduce((sum, stint) => sum + stint.laps, 0);
  const lengthPenalty = totalLaps > 70 ? -2 : totalLaps < 35 ? -1.5 : 0;
  const pitWindowAdjustment = pitStopCount === tirePlan.length - 1 ? 2.6 : -1.8;

  return roundTo(averageCompoundScore + pitWindowAdjustment + lengthPenalty, 2);
}

function scoreWeatherAlignment(
  weatherScenario: RaceScenarioInput["weatherScenario"],
  tirePlan: RaceScenarioInput["tirePlan"],
) {
  const includesWetCompound = tirePlan.some((stint) => ["intermediate", "wet"].includes(stint.compound));

  if (weatherScenario === "dry" && includesWetCompound) {
    return -6;
  }

  if (weatherScenario !== "dry" && !includesWetCompound) {
    return -4;
  }

  return weatherScenario === "dry" ? 2 : 1;
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

function describeConfidence(
  input: RaceScenarioInput,
  context: RaceContext,
  target: ComparisonTarget | null,
) {
  if (input.weatherScenario !== "dry") {
    return "Confidence is lower because mixed or wet assumptions create larger strategy variance than this baseline comparison model can explain.";
  }

  if (input.safetyCarProbability > 0.6) {
    return "Confidence is lower because a high safety-car assumption can rapidly reorder pit windows and track position.";
  }

  if (context.race.round <= 3) {
    return "Confidence is moderate because early-season races provide less prior form for calibration.";
  }

  if (target?.type === "constructor") {
    return "Confidence is strongest when constructor comparisons stay close to the normal field profile and the model can isolate the effect of the chosen team strategy.";
  }

  return "Confidence is strongest here because the field stays on a stable baseline and the model is isolating one target strategy against it.";
}

function buildUndercutNarrative(input: RaceScenarioInput, target: ComparisonTarget | null) {
  const subject = target?.type === "constructor" ? "the selected constructor" : "the selected strategy";

  if (input.pitStopCount >= 3) {
    return `This setup pushes ${subject} toward aggressive track-position swings. The simulator expects undercut attempts to matter more than stint stability.`;
  }

  if (input.pitStopCount === 2) {
    return `This is the comparison sweet spot for ${subject}: pit timing matters without completely overwhelming outright pace.`;
  }

  return `With only one planned stop, the model discounts undercut upside for ${subject} and leans more on clean air, tire preservation, and reliability.`;
}

function buildStrategyExplanation(
  strategy: StrategyProfile,
  entrant: RaceContextEntrant,
  undercutImpact: number,
  round: number,
) {
  if (strategy.pitStopCount >= 3) {
    return `An aggressive multi-stop plan produces an undercut impact of ${undercutImpact.toFixed(1)} for ${entrant.fullName}, rewarding overtaking strength but carrying more variance.`;
  }

  if (strategy.weatherScenario !== "dry") {
    return `The ${strategy.weatherScenario} weather assumption raises variance, so ${entrant.fullName}'s reliability score of ${entrant.reliabilityScore.toFixed(0)} matters more than usual.`;
  }

  if (round <= 3) {
    return `This scenario still leans on limited early-season data, so ${entrant.fullName}'s grid and recent form signals stay more important than edge-case strategy swings.`;
  }

  return `The two-stop profile sits close to the model sweet spot, giving ${entrant.fullName} an undercut impact of ${undercutImpact.toFixed(1)} without overcommitting on pit risk.`;
}

function buildTargetSummary(
  finishingOrder: RaceSimulationResponse["finishingOrder"],
  target: ComparisonTarget | null,
): RaceSimulationResponse["targetSummary"] {
  if (!target) {
    return null;
  }

  const targetEntrants = finishingOrder.filter((entrant) => entrant.isTarget);
  if (targetEntrants.length === 0) {
    return null;
  }

  const averageFinishDelta = roundTo(
    targetEntrants.reduce((sum, entrant) => sum + entrant.finishDelta, 0) / targetEntrants.length,
    2,
  );
  const aggregatePointsDelta = roundTo(
    targetEntrants.reduce((sum, entrant) => sum + entrant.pointsDelta, 0),
    1,
  );

  return {
    title: target.type === "constructor" ? `${target.label} strategy delta` : `${target.label} strategy delta`,
    narrative: buildTargetNarrative(target, averageFinishDelta, aggregatePointsDelta),
    averageFinishDelta,
    aggregatePointsDelta,
    entrants: targetEntrants.map((entrant) => ({
      driverId: entrant.driverId,
      fullName: entrant.fullName,
      constructorId: entrant.constructorId,
      constructorName: entrant.constructorName,
      qualifyingPosition: entrant.qualifyingPosition,
      baselineFinish: entrant.baselineFinish,
      projectedFinish: entrant.projectedFinish,
      finishDelta: entrant.finishDelta,
      baselinePoints: entrant.baselinePoints,
      projectedPoints: entrant.projectedPoints,
      pointsDelta: entrant.pointsDelta,
      podiumProbability: entrant.podiumProbability,
      undercutImpact: entrant.undercutImpact,
      confidence: entrant.confidence,
      explanationSummary: entrant.explanation.at(-1) ?? entrant.explanation[0] ?? "",
    })),
  };
}

function buildTargetNarrative(
  target: ComparisonTarget,
  averageFinishDelta: number,
  aggregatePointsDelta: number,
) {
  const finishPhrase =
    averageFinishDelta > 0.2
      ? `gains an average of ${averageFinishDelta.toFixed(1)} places`
      : averageFinishDelta < -0.2
        ? `gives away ${Math.abs(averageFinishDelta).toFixed(1)} places on average`
        : "holds baseline track position";
  const pointsPhrase =
    aggregatePointsDelta > 0
      ? `worth roughly +${aggregatePointsDelta.toFixed(1)} points versus the baseline field`
      : aggregatePointsDelta < 0
        ? `costing about ${Math.abs(aggregatePointsDelta).toFixed(1)} points against the baseline field`
        : "with points effectively flat to baseline";

  if (target.type === "constructor") {
    return `${target.label} ${finishPhrase}, ${pointsPhrase}.`;
  }

  return `${target.label} ${finishPhrase}, ${pointsPhrase}.`;
}
