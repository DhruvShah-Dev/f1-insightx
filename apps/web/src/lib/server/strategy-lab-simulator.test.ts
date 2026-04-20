import assert from "node:assert/strict";
import test from "node:test";
import type { z } from "zod";
import { raceScenarioSchema } from "@/lib/api/validation";
import type { StrategyLabRaceProduct } from "@/lib/server/strategy-lab-product";
import { simulateRaceScenario } from "@/lib/server/strategy-lab-simulator";

type RaceScenarioInput = z.infer<typeof raceScenarioSchema>;

const baseProduct: StrategyLabRaceProduct = {
  race: {
    id: "2026-04-miami",
    season: 2026,
    round: 4,
    raceName: "Miami Grand Prix",
    officialName: "FORMULA 1 CRYPTO.COM MIAMI GRAND PRIX 2026",
    circuitId: "miami",
    circuitName: "Miami International Autodrome",
    circuitCountry: "United States",
    scheduledAt: "2026-05-03T20:00:00Z",
    sprintWeekend: false,
  },
  overview: {
    archetypeLabel: "Street circuit",
    raceDifficulty: "Medium",
    nominalRaceLaps: 57,
    pitLossEstimateS: 21.8,
    bestStrategyCode: "balanced_2_stop",
    bestStrategyLabel: "Balanced 2-stop",
    keyInsight: "Track position stays important, but the second stop can recover pace late.",
    confidenceScore: 0.68,
    modelVersion: "strategy_lab_model_v2",
    scenarioTemplateVersion: "strategy_templates_v1",
    featureBuildVersion: "race_week_20260420T120000Z",
  },
  entrants: [
    {
      driverId: "max_verstappen",
      fullName: "Max Verstappen",
      constructorId: "red_bull",
      constructorName: "Red Bull",
      projectedFinish: 2,
      finishBandLow: 1,
      finishBandHigh: 4,
      podiumProbability: 70,
      winProbability: 35,
      baselineStrategyCode: "balanced_2_stop",
      baselineTotalTimeS: 5140.2,
      confidenceScore: 0.72,
      strategyFeature: {
        nominalRaceLaps: 57,
        baseRacePaceS: 89.8,
        baseQualiPaceS: 88.9,
        paceEvolutionSPerLap: 0.017,
        pitLossS: 21.6,
        baselineStopCount: 2,
        baselinePitWindowStartLap: 17,
        baselinePitWindowEndLap: 21,
        compoundProfiles: {
          soft: { deltaS: -0.35, degradationSPerLap: 0.088, maxStintLaps: 16 },
          medium: { deltaS: 0, degradationSPerLap: 0.061, maxStintLaps: 24 },
          hard: { deltaS: 0.28, degradationSPerLap: 0.043, maxStintLaps: 30 },
        },
      },
      driverProfile: {
        aggressiveTendencyScore: 0.74,
        tyreManagementScore: 0.63,
        earlyPitBiasScore: 0.57,
        latePitBiasScore: 0.43,
        racecraftProxyScore: 0.79,
        confidenceScore: 0.72,
      },
      constructorProfile: {
        pitEfficiencyScore: 0.77,
        pitLossAdjustmentS: -0.35,
        strategySuccessProxy: 0.74,
        doubleStackRiskScore: 0.22,
        confidenceScore: 0.69,
      },
      scenarios: [
        {
          scenarioCode: "balanced_2_stop",
          scenarioLabel: "Balanced 2-stop",
          pitStopCount: 2,
          compoundSequence: "medium / hard / soft",
          totalRaceTimeS: 5140.2,
          deltaVsBaselineS: 0,
          averageStintDegradationS: 0.061,
          estimatedFinishPosition: 2,
          estimatedFinishBandLow: 1,
          estimatedFinishBandHigh: 4,
          confidenceScore: 0.72,
          recommendationRank: 1,
          rationale: "Balanced baseline.",
        },
      ],
      pitWindows: [
        {
          scenarioCode: "balanced_2_stop",
          stopNumber: 1,
          windowStartLap: 17,
          windowEndLap: 21,
          compoundIn: "hard",
          compoundOut: "medium",
        },
        {
          scenarioCode: "balanced_2_stop",
          stopNumber: 2,
          windowStartLap: 38,
          windowEndLap: 42,
          compoundIn: "soft",
          compoundOut: "hard",
        },
      ],
    },
  ],
};

function buildScenarioInput(overrides: Partial<RaceScenarioInput> = {}): RaceScenarioInput {
  return raceScenarioSchema.parse({
    raceId: "2026-04-miami",
    driverIds: ["max_verstappen"],
    comparisonTargetType: "driver",
    comparisonTargetId: "max_verstappen",
    constructorFocus: [],
    pitStopCount: 2,
    tirePlan: [
      { compound: "medium", laps: 18 },
      { compound: "hard", laps: 21 },
      { compound: "soft", laps: 18 },
    ],
    safetyCarProbability: 0.24,
    weatherScenario: "dry",
    aggressionFactor: 50,
    reliabilityBias: 0,
    qualifyingOverrides: [{ driverId: "max_verstappen", position: 3 }],
    ...overrides,
  });
}

test("simulateRaceScenario applies aggression and reliability controls to the target math", () => {
  const balanced = simulateRaceScenario(buildScenarioInput(), baseProduct);
  const attack = simulateRaceScenario(
    buildScenarioInput({
      aggressionFactor: 82,
      reliabilityBias: -18,
    }),
    baseProduct,
  );

  const balancedEntrant = balanced.finishingOrder[0];
  const attackEntrant = attack.finishingOrder[0];

  assert.notEqual(attackEntrant.totalRaceTimeS, balancedEntrant.totalRaceTimeS);
  assert.ok(
    attackEntrant.explanation.some((line) => line.includes("Aggression") && line.includes("risk-on")),
  );
  assert.equal(attack.scenarioSummary.reliabilityBias, -18);
});

test("simulateRaceScenario makes weather mode materially affect pace assumptions and confidence framing", () => {
  const dry = simulateRaceScenario(buildScenarioInput(), baseProduct);
  const wet = simulateRaceScenario(
    buildScenarioInput({
      weatherScenario: "wet",
      aggressionFactor: 62,
    }),
    baseProduct,
  );

  const dryEntrant = dry.finishingOrder[0];
  const wetEntrant = wet.finishingOrder[0];

  assert.ok(wetEntrant.totalRaceTimeS > dryEntrant.totalRaceTimeS);
  assert.notEqual(wet.confidenceReason, dry.confidenceReason);
  assert.ok(
    wetEntrant.explanation.some((line) => line.includes("Wet conditions")),
  );
  assert.equal(wet.modelMeta.simulatorVersion, "strategy_lab_sim_v2");
});
