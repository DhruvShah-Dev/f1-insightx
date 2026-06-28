import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const publicReadModules = [
  "src/lib/server/f1-platform.ts",
  "src/lib/server/reference-data.ts",
  "src/lib/server/race-week-product.ts",
  "src/lib/server/strategy-lab-product.ts",
  "src/lib/server/race-history.ts",
  "src/lib/server/race-context.ts",
];

test("public product and reference helpers use the RLS-safe Supabase client", async () => {
  for (const modulePath of publicReadModules) {
    const source = await readFile(path.join(process.cwd(), modulePath), "utf-8");

    assert.match(source, /getSupabasePublicClient/);
    assert.doesNotMatch(source, /getSupabasePrivilegedClient|getSupabaseAdminClient/);
  }
});
