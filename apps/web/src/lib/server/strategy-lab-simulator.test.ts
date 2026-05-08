import assert from "node:assert/strict";
import test from "node:test";
import type { z } from "zod";
import { raceScenarioSchema } from "@/lib/api/validation";
import type { StrategyLabRaceProduct } from "@/lib/server/strategy-lab-product";
import { fuelCorrectionS, nonlinearTyreLossS, simulateRaceScenario, trafficLossS } from "@/lib/server/strategy-lab-simulator";

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
        fuelCorrectionSPerLap: 0.035,
        trafficSensitivityScore: 0.62,
        weatherGripSensitivityScore: 0.58,
        energyDeploymentProxyScore: 0.64,
        cornerSpeedStrength: 0.58,
        brakingStrength: 0.62,
        throttlePickupStrength: 0.6,
        tractionExitStrength: 0.64,
        straightLineStrength: 0.7,
        energyDeploymentProxyStrength: 0.64,
        liftAndCoastTendency: 0.08,
        clippingRiskProxy: 0.2,
        overtakingAttackScore: 0.68,
        defendingStrengthScore: 0.66,
        tyreStressProxy: 0.45,
        undercutSuitabilityScore: 0.61,
        highDegradationRiskScore: 0.5,
        trackArchetype: "power-sensitive",
        trackPositionSensitivityScore: 0.36,
        telemetryProxyConfidence: 0.72,
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

test("fuel correction separates early fuel mass from tyre degradation trend", () => {
  assert.ok(fuelCorrectionS(1, 50, 0.035) > fuelCorrectionS(45, 50, 0.035));
  assert.ok(fuelCorrectionS(45, 50, 0.035) < 0);
});

test("nonlinear tyre model has warmup/plateau/cliff phase behavior", () => {
  const warmup = nonlinearTyreLossS("soft", 2, 20, 0.08, 0.6);
  const plateau = nonlinearTyreLossS("soft", 10, 20, 0.08, 0.6);
  const cliff = nonlinearTyreLossS("soft", 20, 20, 0.08, 0.6);

  assert.ok(warmup < plateau);
  assert.ok(cliff > plateau);
});

test("traffic model penalizes low pace advantage behind traffic", () => {
  const trapped = trafficLossS({ gridPosition: 12, racecraftScore: 0.45, trafficSensitivityScore: 0.8, overtakeDifficulty: 1.2, paceAdvantageS: 0.1 });
  const clear = trafficLossS({ gridPosition: 3, racecraftScore: 0.8, trafficSensitivityScore: 0.4, overtakeDifficulty: 0.8, paceAdvantageS: 0.9 });

  assert.ok(trapped > clear);
});

test("energy behavior is explicitly labelled as proxy, not true ERS", () => {
  const response = simulateRaceScenario(buildScenarioInput(), baseProduct);

  assert.ok(response.sensitivity.some((item) => item.factor === "energy_proxy"));
  assert.ok(response.modelMeta.assumptions.some((line) => line.toLowerCase().includes("proxy")));
  assert.ok(response.finishingOrder[0].explanation.some((line) => line.includes("not true ERS")));
});

test("track archetype telemetry signals alter sensitivity and outcome", () => {
  const powerSensitive = simulateRaceScenario(buildScenarioInput(), baseProduct);
  const trackPositionProduct: StrategyLabRaceProduct = {
    ...baseProduct,
    entrants: baseProduct.entrants.map((entrant) => ({
      ...entrant,
      strategyFeature: {
        ...entrant.strategyFeature,
        straightLineStrength: 0.28,
        overtakingAttackScore: 0.3,
        defendingStrengthScore: 0.42,
        trafficSensitivityScore: 0.82,
        undercutSuitabilityScore: 0.72,
        trackArchetype: "track-position-dominant",
        trackPositionSensitivityScore: 0.86,
      },
    })),
  };
  const trackPosition = simulateRaceScenario(buildScenarioInput(), trackPositionProduct);

  assert.notEqual(trackPosition.finishingOrder[0].totalRaceTimeS, powerSensitive.finishingOrder[0].totalRaceTimeS);
  assert.ok(trackPosition.sensitivity.some((item) => item.factor === "track_position_sensitivity" && item.explanation.includes("Track-position")));
});

test("telemetry signal changes strategy sensitivity explanation", () => {
  const response = simulateRaceScenario(buildScenarioInput(), baseProduct);

  assert.ok(response.sensitivity.some((item) => item.factor === "straight_line_strength"));
  assert.ok(response.sensitivity.some((item) => item.explanation.includes("telemetry") || item.explanation.includes("proxy")));
});

test("strategy intelligence layer surfaces bands, top drivers, weakest assumption, and outcome cause", () => {
  const response = simulateRaceScenario(
    buildScenarioInput({
      weatherScenario: "mixed",
      safetyCarProbability: 0.62,
    }),
    baseProduct,
  );

  assert.ok(response.positionTransitionBands.length > 0);
  assert.match(response.positionTransitionBands[0]!.projectedBand, /^P\d+/);
  assert.equal(response.topSensitivityDrivers.length, 3);
  assert.ok(response.topSensitivityDrivers.every((item) => item.impactS > 0));
  assert.equal(response.weakestAssumption.factor, "weather");
  assert.ok(response.confidenceReason.includes("finish bands"));
  assert.ok(response.whatChangedOutcome.drivers.some((line) => line.includes("Weather") || line.includes("Tyre") || line.includes("Pit")));
});
