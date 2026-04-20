import assert from "node:assert/strict";
import test from "node:test";
import { resolveRuntimeSource } from "./runtime-source";

test("resolveRuntimeSource returns degraded mode with carried failure reason when primary fails", async () => {
  const result = await resolveRuntimeSource({
    surface: "strategy-lab",
    primary: {
      sourceKind: "database",
      sourceLabel: "strategy_lab_views",
      load: async () => {
        throw new Error("database down");
      },
    },
    degraded: {
      sourceKind: "csv-product",
      sourceLabel: "strategy_lab_csv",
      load: async () => ({ ok: true }),
      describe: () => ({
        eventId: "2026-04-miami",
        season: 2026,
        round: 4,
        generatedAt: "2026-04-16T12:00:00Z",
      }),
    },
  });

  assert.equal(result.mode, "degraded");
  assert.deepEqual(result.data, { ok: true });
  assert.equal(result.meta.sourceKind, "csv-product");
  assert.equal(result.meta.sourceLabel, "strategy_lab_csv");
  assert.equal(result.meta.reason, "database down");
  assert.equal(result.meta.generatedAt, "2026-04-16T12:00:00Z");
});
