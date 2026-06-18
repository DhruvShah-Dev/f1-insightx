import assert from "node:assert/strict";
import test from "node:test";
import {
  __achievementTestUtils,
  getAchievementsSeason,
  listAchievementSeasons,
  type AchievementMetricId,
  type AchievementEntry,
} from "./achievements-product";

const expectedMetricIds: AchievementMetricId[] = [
  "lapsCompleted",
  "lapsLed",
  "overtakes",
  "pitStops",
  "positionsGained",
  "positionsLost",
  "dnfs",
];

function isDescending(entries: AchievementEntry[]) {
  return entries.every((entry, index) => index === 0 || entries[index - 1].value >= entry.value);
}

test("Achievements defaults to the latest available season", async () => {
  const seasons = await listAchievementSeasons();
  const achievements = await getAchievementsSeason();

  assert.ok(seasons.length > 0);
  assert.ok(achievements);
  assert.equal(achievements.season, seasons[0]);
});

test("Achievements excludes zero-value drivers from every metric", async () => {
  const achievements = await getAchievementsSeason();
  assert.ok(achievements);

  for (const metric of Object.values(achievements.metrics)) {
    assert.ok(metric.entries.length > 0);
    assert.ok(metric.entries.every((entry) => entry.value > 0), metric.id);
  }
});

test("Achievements exposes all driver leaderboard metrics", async () => {
  const achievements = await getAchievementsSeason();
  assert.ok(achievements);

  assert.deepEqual(Object.keys(achievements.metrics).sort(), [...expectedMetricIds].sort());
});

test("Achievements sorts every metric from most to least", async () => {
  const achievements = await getAchievementsSeason();
  assert.ok(achievements);

  for (const metric of Object.values(achievements.metrics)) {
    assert.equal(isDescending(metric.entries), true, metric.id);
    assert.deepEqual(metric.entries.map((entry) => entry.rank), metric.entries.map((_, index) => index + 1));
  }
});

test("Achievements labels overtakes as proxy-based", async () => {
  const achievements = await getAchievementsSeason();
  assert.ok(achievements);

  assert.match(achievements.metrics.overtakes.sourceLabel.toLowerCase(), /proxy|inferred/);
  assert.match(achievements.metrics.overtakes.description.toLowerCase(), /proxy/);
});

test("Achievements computes position gain and loss leaderboards from net position changes", async () => {
  const achievements = await getAchievementsSeason();
  assert.ok(achievements);

  assert.ok(achievements.metrics.positionsGained.entries.length > 0);
  assert.ok(achievements.metrics.positionsLost.entries.length > 0);
  assert.match(achievements.metrics.positionsGained.sourceLabel.toLowerCase(), /classification/);
  assert.match(achievements.metrics.positionsLost.description.toLowerCase(), /negative/);
});

test("Achievements DNF status rules include only non-classified statuses", () => {
  assert.equal(__achievementTestUtils.isDnfStatus("Retired"), true);
  assert.equal(__achievementTestUtils.isDnfStatus("Did not start"), true);
  assert.equal(__achievementTestUtils.isDnfStatus("Disqualified"), true);
  assert.equal(__achievementTestUtils.isDnfStatus("Finished"), false);
  assert.equal(__achievementTestUtils.isDnfStatus("Lapped"), false);
});

test("Achievements route redirects to the canonical Championship route", async () => {
  const { readFile } = await import("node:fs/promises");
  const [pageSource, configSource] = await Promise.all([
    readFile(new URL("../../app/achievements/page.tsx", import.meta.url), "utf-8"),
    readFile(new URL("../../../next.config.ts", import.meta.url), "utf-8"),
  ]);

  assert.match(pageSource, /redirect\("\/championship"\)/);
  assert.doesNotMatch(pageSource, /Driver Leaderboards|<section|<main/);
  assert.match(configSource, /source:\s*"\/achievements"/);
  assert.match(configSource, /destination:\s*"\/championship"/);
  assert.match(configSource, /permanent:\s*false/);
});

test("Achievements maps driver IDs and codes to display names", async () => {
  const achievements = await getAchievementsSeason(2026);
  assert.ok(achievements);

  const lapsLeader = achievements.metrics.lapsCompleted.entries[0];
  assert.ok(lapsLeader);
  assert.match(lapsLeader.driverCode, /^[A-Z]{2,3}$/);
  assert.notEqual(lapsLeader.driverName, lapsLeader.driverCode);
  assert.notEqual(lapsLeader.teamName, "");
});
