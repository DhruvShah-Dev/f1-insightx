import { parseNumber, readCsvFile } from "@/lib/server/csv";
import { getCurrentDriverMeta } from "@/lib/ui/driver-asset-manifest";

export type DriverStanding = {
  driverId: string;
  firstName: string;
  lastName: string;
  displayName: string;
  teamId: string;
  teamName: string;
  points: number;
  standingPosition: number;
  code: string | null;
  nationality: string | null;
};

export type CurrentSeasonDriverStandings = {
  season: number;
  latestRaceId: string;
  latestRaceName: string;
  latestRaceDate: string;
  items: DriverStanding[];
};

type CsvRace = {
  id: string;
  season: string;
  round: string;
  race_name: string;
  scheduled_at: string;
};

type CsvDriver = {
  id: string;
  full_name: string;
  nationality: string;
};

type CsvConstructor = {
  id: string;
  name: string;
};

type CsvDriverStanding = {
  race_id: string;
  season: string;
  round: string;
  driver_id: string;
  constructor_id: string;
  standing_position: string;
  points: string;
  wins: string;
};

type CsvConstructorStanding = {
  race_id: string;
  season: string;
  round: string;
  constructor_id: string;
  standing_position: string;
  points: string;
  wins: string;
};

export type ConstructorStanding = {
  constructorId: string;
  constructorName: string;
  points: number;
  standingPosition: number;
  wins: number;
};

export type ChampionshipStandingsSeason = {
  season: number;
  latestRaceId: string;
  latestRaceName: string;
  latestRaceDate: string;
  drivers: DriverStanding[];
  constructors: ConstructorStanding[];
};

async function loadChampionshipCsvRows() {
  const [races, drivers, constructors, driverStandings, constructorStandings] = await Promise.all([
    readCsvFile<CsvRace>("curated.races"),
    readCsvFile<CsvDriver>("curated.drivers"),
    readCsvFile<CsvConstructor>("curated.constructors"),
    readCsvFile<CsvDriverStanding>("curated.driverStandings"),
    readCsvFile<CsvConstructorStanding>("curated.constructorStandings"),
  ]);

  return { races, drivers, constructors, driverStandings, constructorStandings };
}

function latestRaceForSeason(rows: Array<{ season: string; round: string; race_id: string }>, season: number) {
  return rows
    .filter((row) => parseNumber(row.season) === season)
    .sort((left, right) => (parseNumber(right.round) ?? 0) - (parseNumber(left.round) ?? 0))[0]?.race_id ?? null;
}

function compareStandingPosition(
  left: { standing_position: string; points: string; wins: string },
  right: { standing_position: string; points: string; wins: string },
) {
  return (
    (parseNumber(left.standing_position) ?? 999) - (parseNumber(right.standing_position) ?? 999) ||
    (parseNumber(right.points) ?? 0) - (parseNumber(left.points) ?? 0) ||
    (parseNumber(right.wins) ?? 0) - (parseNumber(left.wins) ?? 0)
  );
}

export async function listChampionshipSeasons(): Promise<number[]> {
  const { driverStandings, constructorStandings } = await loadChampionshipCsvRows();
  return [
    ...new Set(
      [...driverStandings, ...constructorStandings]
        .map((row) => parseNumber(row.season))
        .filter((season): season is number => season !== null),
    ),
  ].sort((left, right) => right - left);
}

export async function getChampionshipStandingsSeason(season?: number): Promise<ChampionshipStandingsSeason | null> {
  const { races, drivers, constructors, driverStandings, constructorStandings } = await loadChampionshipCsvRows();
  const seasons = await listChampionshipSeasons();
  const selectedSeason = season && seasons.includes(season) ? season : seasons[0];
  if (!selectedSeason) {
    return null;
  }

  const latestRaceId =
    latestRaceForSeason(driverStandings, selectedSeason) ?? latestRaceForSeason(constructorStandings, selectedSeason);
  if (!latestRaceId) {
    return null;
  }

  const race = races.find((item) => item.id === latestRaceId);
  const driversById = new Map(drivers.map((driver) => [driver.id, driver]));
  const constructorsById = new Map(constructors.map((constructor) => [constructor.id, constructor]));

  const mappedDrivers = driverStandings
    .filter((row) => row.race_id === latestRaceId)
    .sort(compareStandingPosition)
    .map((row) => {
      const driver = driversById.get(row.driver_id);
      const constructor = constructorsById.get(row.constructor_id);
      const meta = getCurrentDriverMeta(row.driver_id);
      const driverName = driver?.full_name ?? row.driver_id;
      const parts = driverName.trim().split(/\s+/);

      return {
        driverId: row.driver_id,
        firstName: meta.firstName !== "Current" ? meta.firstName : parts.slice(0, -1).join(" ") || parts[0] || driverName,
        lastName: meta.lastName !== "Driver" ? meta.lastName : parts.at(-1) || driverName,
        displayName: meta.displayName !== "Driver" ? meta.displayName : driverName,
        teamId: row.constructor_id,
        teamName: constructor?.name ?? row.constructor_id,
        points: parseNumber(row.points) ?? 0,
        standingPosition: parseNumber(row.standing_position) ?? 0,
        code: meta.driverCode !== "DRV" ? meta.driverCode : null,
        nationality: meta.nationality !== "Nationality pending" ? meta.nationality : driver?.nationality ?? null,
      } satisfies DriverStanding;
    });

  const mappedConstructors = constructorStandings
    .filter((row) => row.race_id === latestRaceId)
    .sort(compareStandingPosition)
    .map((row) => ({
      constructorId: row.constructor_id,
      constructorName: constructorsById.get(row.constructor_id)?.name ?? row.constructor_id,
      points: parseNumber(row.points) ?? 0,
      standingPosition: parseNumber(row.standing_position) ?? 0,
      wins: parseNumber(row.wins) ?? 0,
    } satisfies ConstructorStanding));

  return {
    season: selectedSeason,
    latestRaceId,
    latestRaceName: race?.race_name ?? latestRaceId,
    latestRaceDate: race?.scheduled_at ?? "",
    drivers: mappedDrivers,
    constructors: mappedConstructors,
  };
}

export async function getCurrentSeasonDriverStandings(): Promise<CurrentSeasonDriverStandings | null> {
  const { getCurrentDriverStandingsSnapshot } = await import("@/lib/server/f1-platform");
  const snapshot = await getCurrentDriverStandingsSnapshot();
  if (!snapshot) {
    return null;
  }

  return {
    season: snapshot.season,
    latestRaceId: snapshot.race.id,
    latestRaceName: snapshot.race.raceName,
    latestRaceDate: snapshot.race.scheduledAt,
    items: snapshot.items.map((item) => {
      const meta = getCurrentDriverMeta(item.driverId);
      const parts = item.driverName.trim().split(/\s+/);
      const firstName = meta.firstName || parts.slice(0, -1).join(" ") || parts[0] || item.driverName;
      const lastName = meta.lastName || parts.at(-1) || item.driverName;

      return {
        driverId: item.driverId,
        firstName,
        lastName,
        displayName: meta.displayName !== "Driver" ? meta.displayName : item.driverName,
        teamId: item.constructorId,
        teamName: meta.currentTeamName !== "Constructor" ? meta.currentTeamName : item.constructorName,
        points: item.points,
        standingPosition: item.standingPosition,
        code: meta.driverCode !== "DRV" ? meta.driverCode : null,
        nationality: meta.nationality !== "Nationality pending" ? meta.nationality : item.nationality,
      };
    }),
  };
}

export async function getCurrentSeasonConstructorStandings(): Promise<{
  season: number;
  latestRaceId: string;
  latestRaceName: string;
  latestRaceDate: string;
  items: ConstructorStanding[];
} | null> {
  const { getCurrentConstructorStandingsSnapshot } = await import("@/lib/server/f1-platform");
  const snapshot = await getCurrentConstructorStandingsSnapshot();
  if (!snapshot) {
    return null;
  }

  return {
    season: snapshot.season,
    latestRaceId: snapshot.race.id,
    latestRaceName: snapshot.race.raceName,
    latestRaceDate: snapshot.race.scheduledAt,
    items: snapshot.items.map((item) => ({
      constructorId: item.constructorId,
      constructorName: item.constructorName,
      points: item.points,
      standingPosition: item.standingPosition,
      wins: item.wins,
    })),
  };
}
