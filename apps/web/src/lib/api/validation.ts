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

const qualifyingOverrideSchema = z.object({
  driverId: z.string().min(1),
  position: z.coerce.number().int().min(1).max(20),
});

export const raceScenarioSchema = z.object({
  raceId: z.string().min(1),
  driverIds: z.array(z.string().min(1)).min(1).max(20),
  constructorFocus: z.array(z.string().min(1)).max(10).default([]),
  pitStopCount: z.coerce.number().int().min(1).max(4),
  tirePlan: z.array(tireStintSchema).min(1).max(4),
  safetyCarProbability: z.coerce.number().min(0).max(1),
  weatherScenario: z.enum(["dry", "mixed", "wet"]),
  aggressionFactor: z.coerce.number().min(0).max(100),
  reliabilityBias: z.coerce.number().min(-25).max(25),
  qualifyingOverrides: z.array(qualifyingOverrideSchema).max(20).default([]),
  notes: z.string().max(500).optional(),
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
