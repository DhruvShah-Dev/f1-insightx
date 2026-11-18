import assert from "node:assert/strict";
import test from "node:test";
import { verdictResult, verdictSentence } from "../src/lib/verdict-story.ts";

test("classified finishers show the official grid-to-finish change", () => {
  const row = { code: "LEC", name: "Charles Leclerc", grid: 7, finish: 3, status: "Finished", points: 15 };
  assert.equal(verdictResult(row).change, 4);
  assert.equal(verdictResult(row).changeLabel, "+4 gained");
  assert.match(verdictSentence(row), /gaining 4 places/);
  assert.equal(verdictResult({ ...row, grid: 2, finish: 5, status: "Lapped" }).change, -3);
});

test("retirements and unavailable grid places do not become plotted gains", () => {
  const row = { code: "NOR", name: "Lando Norris", grid: 5, finish: 18, status: "Retired", points: 0 };
  assert.equal(verdictResult(row).change, null);
  assert.equal(verdictResult(row).plotFinish, null);
  assert.match(verdictSentence(row), /retired/);
  assert.equal(verdictResult({ ...row, grid: 0, status: "Finished" }).gridLabel, "Pit-lane start");
  assert.equal(verdictResult({ ...row, grid: null, status: "Finished" }).change, null);
});
