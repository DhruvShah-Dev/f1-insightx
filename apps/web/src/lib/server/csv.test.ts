import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { csvFileMap, readCsvFile, resolveCsvFilePath, type CsvFileKey } from "./csv";

test("CSV file map resolves declared product-view keys", () => {
  assert.ok(csvFileMap["analytics.sessionIndex"]);
  assert.ok(csvFileMap["strategyLab.features"]);
  assert.ok(csvFileMap["curated.races"]);
  assert.match(resolveCsvFilePath("analytics.sessionIndex"), /analytics_session_index\.csv$/);
});

test("CSV loader rejects unknown file keys", async () => {
  await assert.rejects(
    () => readCsvFile("unknown.productView" as CsvFileKey),
    /Unknown CSV file key/,
  );
});

test("CSV loader reads a known dataset", async () => {
  const rows = await readCsvFile("analytics.sessionIndex");

  assert.ok(rows.length > 0);
  assert.ok(rows[0].session_id);
});

test("CSV loader avoids legacy dynamic directory APIs", async () => {
  const source = await readFile(new URL("./csv.ts", import.meta.url), "utf-8");

  assert.doesNotMatch(source, /readDataCsv|readCuratedCsv|readDataCsvOptional|readCuratedCsvOptional/);
  assert.doesNotMatch(source, /relativeDirectory|fileName/);
  assert.doesNotMatch(source, /readdir|glob/);
});
