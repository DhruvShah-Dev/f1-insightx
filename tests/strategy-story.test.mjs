import assert from "node:assert/strict";
import test from "node:test";
import {
  alternativeTimingCandidates,
  estimatedCycleForStint,
  recordedStopForStint,
  selectStrategyStint,
} from "../src/lib/strategy-story.ts";

const stint = (code, number, startLap) => ({ code, stint: number, compound: "HARD", startLap, endLap: startLap + 10, length: 11, medianS: 90, note: null });
const pit = (id, code, lap) => ({ id, code, lap, timestampUtc: "2026-03-08T04:00:00Z", detail: "Pit duration 20.0 s", source: "openf1:pit", limitation: null });

test("stint URL selection restores either driver and invalid keys fall back to A's first stopped stint", () => {
  const rows = [stint("LEC", 1, 1), stint("LEC", 2, 20), stint("RUS", 1, 1), stint("RUS", 2, 23)];
  assert.equal(selectStrategyStint(rows, "RUS-2", "LEC", "RUS")?.code, "RUS");
  assert.equal(selectStrategyStint(rows, "NOR-2", "LEC", "RUS")?.stint, 2);
  assert.equal(selectStrategyStint(rows, undefined, "LEC", "RUS")?.code, "LEC");
  assert.equal(selectStrategyStint([], undefined, "LEC", "RUS"), null);
});

test("recorded stops and estimates require an exact pit-to-stint lap match", () => {
  const row = stint("LEC", 2, 20);
  const recorded = pit("a", "LEC", 19);
  assert.equal(recordedStopForStint(row, [pit("b", "LEC", 18), recorded])?.id, "a");
  assert.equal(recordedStopForStint(row, [pit("b", "LEC", 18)]), null);
  assert.equal(estimatedCycleForStint(row, [{ code: "LEC", stop: 1, lap: 19, lossS: 22, confidence: .62, weakestAssumption: "proxy" }])?.lossS, 22);
  assert.equal(recordedStopForStint(stint("LEC", 1, 1), [recorded]), null);
});

test("alternative windows require a nearby rival stop or explicit SC/VSC, excluding the actual stop", () => {
  const actual = pit("a", "LEC", 20);
  const rows = alternativeTimingCandidates(actual, "RUS", [pit("b", "RUS", 18), pit("c", "RUS", 24), pit("d", "LEC", 19)], [
    { id: "sc", startLap: 21, endLap: 22, label: "safety-car", source: "track_status_only", limitation: null },
    { id: "yellow", startLap: 19, endLap: 19, label: "yellow", source: "track_status_only", limitation: null },
  ]);
  assert.deepEqual(rows.map((row) => row.lap), [21, 18, 22]);
  assert.equal(rows[0]?.status?.label, "safety-car");
  assert.equal(alternativeTimingCandidates(null, "RUS", [pit("b", "RUS", 18)], [] ).length, 0);
});
