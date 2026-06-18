import { z } from "zod";

export const pitWallPickPayloadSchema = z.object({
  raceId: z.string().min(1),
  qualifyingTop3: z.tuple([z.string().min(1), z.string().min(1), z.string().min(1)]),
  raceTop3: z.tuple([z.string().min(1), z.string().min(1), z.string().min(1)]),
  randomDrivers: z.tuple([z.string().min(1), z.string().min(1), z.string().min(1)]),
  fastestPitStopDriverId: z.string().min(1),
  fastestLapDriverId: z.string().min(1),
});

export type PitWallPickPayloadInput = z.infer<typeof pitWallPickPayloadSchema>;

export function scorePositionPick(actualPosition: number | null | undefined, targetPosition: number) {
  if (actualPosition === null || actualPosition === undefined || !Number.isFinite(actualPosition)) {
    return null;
  }
  if (actualPosition === targetPosition) {
    return 3;
  }
  return Math.abs(actualPosition - targetPosition) === 1 ? 1 : 0;
}

export function scoreSpecialPick(actualDriverId: string | null | undefined, pickedDriverId: string) {
  if (!actualDriverId) {
    return null;
  }
  return actualDriverId === pickedDriverId ? 3 : 0;
}

export function deterministicRandomPositions(raceId: string): [number, number, number] {
  let hash = 0;
  for (let index = 0; index < raceId.length; index += 1) {
    hash = (hash * 31 + raceId.charCodeAt(index)) >>> 0;
  }
  const pool = Array.from({ length: 17 }, (_, index) => index + 4);
  const selected: number[] = [];
  while (selected.length < 3) {
    hash = (hash * 1664525 + 1013904223) >>> 0;
    const index = hash % pool.length;
    selected.push(pool.splice(index, 1)[0] ?? 4);
  }
  return selected as [number, number, number];
}

export function validateNoDuplicateGroups(input: PitWallPickPayloadInput) {
  const groups = [
    { label: "qualifying top 3", values: input.qualifyingTop3 },
    { label: "race top 3", values: input.raceTop3 },
    { label: "random positions", values: input.randomDrivers },
  ];

  for (const group of groups) {
    if (new Set(group.values).size !== group.values.length) {
      return `${group.label} cannot include the same driver more than once.`;
    }
  }

  return null;
}
