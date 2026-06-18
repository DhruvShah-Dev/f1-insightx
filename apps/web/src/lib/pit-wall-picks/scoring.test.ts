import assert from "node:assert/strict";
import test from "node:test";
import {
  deterministicRandomPositions,
  scorePositionPick,
  scoreSpecialPick,
  validateNoDuplicateGroups,
} from "@/lib/pit-wall-picks/scoring";

const validPayload = {
  raceId: "2026_01_bahrain",
  qualifyingTop3: ["norris", "piastri", "leclerc"] as [string, string, string],
  raceTop3: ["piastri", "norris", "max_verstappen"] as [string, string, string],
  randomDrivers: ["russell", "hamilton", "sainz"] as [string, string, string],
  fastestPitStopDriverId: "piastri",
  fastestLapDriverId: "norris",
};

test("scores exact position picks as 3 points", () => {
  assert.equal(scorePositionPick(1, 1), 3);
});

test("scores +/-1 position picks as 1 point", () => {
  assert.equal(scorePositionPick(2, 1), 1);
  assert.equal(scorePositionPick(6, 7), 1);
});

test("scores incorrect position picks as 0 points", () => {
  assert.equal(scorePositionPick(5, 1), 0);
});

test("keeps missing official position results pending", () => {
  assert.equal(scorePositionPick(null, 1), null);
});

test("scores special driver picks only on exact match", () => {
  assert.equal(scoreSpecialPick("norris", "norris"), 3);
  assert.equal(scoreSpecialPick("norris", "piastri"), 0);
  assert.equal(scoreSpecialPick(null, "piastri"), null);
});

test("generates stable race-wide random positions outside the top 3", () => {
  const first = deterministicRandomPositions("2026_01_bahrain");
  const second = deterministicRandomPositions("2026_01_bahrain");
  assert.deepEqual(first, second);
  assert.equal(new Set(first).size, 3);
  assert.ok(first.every((position) => position >= 4 && position <= 20));
});

test("rejects duplicate drivers inside a pick group", () => {
  assert.equal(validateNoDuplicateGroups(validPayload), null);
  assert.match(
    validateNoDuplicateGroups({
      ...validPayload,
      qualifyingTop3: ["norris", "norris", "leclerc"],
    }) ?? "",
    /qualifying top 3/,
  );
});
