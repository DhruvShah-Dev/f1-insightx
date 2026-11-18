import assert from "node:assert/strict";
import { test } from "node:test";
import { buildStakesFocus } from "../src/lib/stakes.ts";

test("focuses the largest qualifying-to-grid change without race results", () => {
  const qualifying = [
    { code: "AAA", name: "Driver A", position: 1 },
    { code: "BBB", name: "Driver B", position: 2 },
    { code: "CCC", name: "Driver C", position: 3 },
  ];
  const grid = [
    { code: "AAA", name: "Driver A", grid: 1, finish: 20 },
    { code: "BBB", name: "Driver B", grid: 8, finish: 1 },
    { code: "CCC", name: "Driver C", grid: 2, finish: 3 },
  ];
  const expected = {
    code: "BBB",
    question: "Can Driver B recover from a P8 start after qualifying P2?",
  };
  assert.deepEqual(buildStakesFocus(qualifying, grid), expected);
  assert.deepEqual(buildStakesFocus(qualifying, grid.map((row) => ({ ...row, finish: 21 - row.finish }))), expected);
});

test("uses pole when qualifying and grid match", () => {
  assert.deepEqual(
    buildStakesFocus([{ code: "AAA", name: "Driver A", position: 1 }], [{ code: "AAA", name: "Driver A", grid: 1 }]),
    { code: "AAA", question: "Can Driver A turn pole into a win?" },
  );
});

test("handles a results-only report without invented qualifying or grid positions", () => {
  assert.deepEqual(
    buildStakesFocus([], [{ code: "AAA", name: "Driver A", grid: null }]),
    { code: "AAA", question: "What was at stake before lights out?" },
  );
});
