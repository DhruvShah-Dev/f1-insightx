import { z, ZodError } from "zod";

type FlattenedValidationError = {
  formErrors: string[];
  fieldErrors: Record<string, string[] | undefined>;
};

export function flattenZodError(error: ZodError): FlattenedValidationError {
  const flattened = z.flattenError(error);
  return {
    formErrors: flattened.formErrors,
    fieldErrors: flattened.fieldErrors,
  };
}

export const referenceQuerySchema = z.object({
  search: z.string().trim().min(1).max(50).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const racesQuerySchema = z.object({
  season: z.coerce.number().int().min(1950).max(2100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const tireStintSchema = z.object({
  compound: z.enum(["soft", "medium", "hard", "intermediate", "wet"]),
  laps: z.coerce.number().int().min(1).max(80),
});

const tyrePressureSchema = z.object({
  frontPsi: z.coerce.number().min(18).max(30),
  rearPsi: z.coerce.number().min(18).max(30),
});

const qualifyingOverrideSchema = z.object({
  driverId: z.string().min(1),
  position: z.coerce.number().int().min(1).max(20),
});

export const raceScenarioSchema = z
  .object({
    raceId: z.string().min(1),
    driverIds: z.array(z.string().min(1)).min(1).max(20),
    comparisonTargetType: z.enum(["driver", "constructor"]).optional(),
    comparisonTargetId: z.string().min(1).optional(),
    constructorFocus: z.array(z.string().min(1)).max(10).default([]),
    pitStopCount: z.coerce.number().int().min(1).max(4),
    tirePlan: z.array(tireStintSchema).min(1).max(4),
    pitLaps: z.array(z.coerce.number().int().min(1).max(80)).max(4),
    tyrePressure: tyrePressureSchema,
    safetyCarProbability: z.coerce.number().min(0).max(1),
    weatherScenario: z.enum(["dry", "mixed", "wet"]),
    aggressionFactor: z.coerce.number().min(0).max(100),
    reliabilityBias: z.coerce.number().min(-25).max(25),
    qualifyingOverrides: z.array(qualifyingOverrideSchema).max(20).default([]),
    notes: z.string().max(500).optional(),
  })
  .superRefine((value, context) => {
    const expectedStops = Math.max(0, value.tirePlan.length - 1);
    if (value.pitStopCount !== expectedStops) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pitStopCount"],
        message: "Pit stop count must match the compound sequence length.",
      });
    }

    if (value.pitLaps.length !== expectedStops) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pitLaps"],
        message: "Pit laps must match the number of planned pit stops.",
      });
    }

    const compounds = value.tirePlan.map((stint) => stint.compound);
    if (new Set(compounds).size < 2) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tirePlan"],
        message: "Race strategy must use at least two tyre compounds.",
      });
    }

    const dryCompounds = new Set(["soft", "medium", "hard"]);
    if (value.weatherScenario === "dry" && compounds.some((compound) => !dryCompounds.has(compound))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tirePlan"],
        message: "Dry race scenarios must use dry compounds only.",
      });
    }

    const totalLaps = value.tirePlan.reduce((sum, stint) => sum + stint.laps, 0);
    const uniquePitLaps = new Set(value.pitLaps);
    if (uniquePitLaps.size !== value.pitLaps.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pitLaps"],
        message: "Pit laps must be unique.",
      });
    }

    for (let index = 0; index < value.pitLaps.length; index += 1) {
      const pitLap = value.pitLaps[index]!;
      const previous = value.pitLaps[index - 1];
      if (previous !== undefined && pitLap <= previous) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["pitLaps", index],
          message: "Pit laps must be sorted from earliest to latest.",
        });
      }

      if (pitLap >= totalLaps) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["pitLaps", index],
          message: "Pit laps must fall before the final race lap.",
        });
      }
    }

    if (value.pitLaps.length === expectedStops) {
      const boundaries = [0, ...value.pitLaps, totalLaps];
      const derivedStints = boundaries.slice(1).map((boundary, index) => boundary - boundaries[index]!);
      derivedStints.forEach((laps, index) => {
        if (laps <= 0) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["tirePlan", index, "laps"],
            message: "Every stint must contain at least one racing lap.",
          });
        }

        if (value.tirePlan[index] && value.tirePlan[index].laps !== laps) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["tirePlan", index, "laps"],
            message: "Stint lengths must match the submitted pit laps.",
          });
        }
      });
    }
  });

export const fantasyRequestSchema = z.object({
  season: z.coerce.number().int().min(1950).max(2100),
  round: z.coerce.number().int().min(1).max(30).optional(),
  budget: z.coerce.number().positive().max(200),
  preferredDriverIds: z.array(z.string().min(1)).max(5).default([]),
  preferredConstructorIds: z.array(z.string().min(1)).max(2).default([]),
  excludedIds: z.array(z.string().min(1)).max(10).default([]),
  riskProfile: z.enum(["safe", "balanced", "aggressive"]),
  scoringFocus: z.enum(["points", "value", "differential"]),
  lockCaptain: z.boolean().default(false),
});
