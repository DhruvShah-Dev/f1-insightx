import assert from "node:assert/strict";
import test from "node:test";
import {
  getChampionshipStandingsSeason,
  listChampionshipSeasons,
  type ConstructorStanding,
  type DriverStanding,
} from "./standings";

function isStandingOrder<T extends DriverStanding | ConstructorStanding>(items: T[]) {
  return items.every((item, index) => index === 0 || items[index - 1].standingPosition <= item.standingPosition);
}

test("Championship standings defaults to the latest available season", async () => {
  const seasons = await listChampionshipSeasons();
  const championship = await getChampionshipStandingsSeason();

  assert.ok(seasons.length > 0);
  assert.ok(championship);
  assert.equal(championship.season, seasons[0]);
});

test("Championship selected year returns matching standings", async () => {
  const championship = await getChampionshipStandingsSeason(2024);

  assert.ok(championship);
  assert.equal(championship.season, 2024);
  assert.ok(championship.latestRaceName.length > 0);
  assert.match(championship.latestRaceDate, /^2024-/);
  assert.ok(championship.drivers.length > 0);
  assert.ok(championship.constructors.length > 0);
});

test("Championship standings sort by championship order", async () => {
  const championship = await getChampionshipStandingsSeason(2024);

  assert.ok(championship);
  assert.equal(isStandingOrder(championship.drivers), true);
  assert.equal(isStandingOrder(championship.constructors), true);
  assert.deepEqual(championship.drivers.map((driver) => driver.standingPosition), championship.drivers.map((_, index) => index + 1));
  assert.deepEqual(
    championship.constructors.map((constructor) => constructor.standingPosition),
    championship.constructors.map((_, index) => index + 1),
  );
});

test("Championship historical seasons are loaded from CSV data", async () => {
  const seasons = await listChampionshipSeasons();
  const historical = await getChampionshipStandingsSeason(2025);

  assert.ok(seasons.includes(2024));
  assert.ok(seasons.includes(2025));
  assert.ok(historical);
  assert.equal(historical.season, 2025);
  assert.ok(historical.drivers[0].displayName.length > 0);
  assert.ok(historical.constructors[0].constructorName.length > 0);
});
