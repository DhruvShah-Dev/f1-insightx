import { cache } from "react";
import { parseNumber, readCuratedCsv, readCuratedCsvOptional } from "@/lib/server/csv";
import { getSupabaseAdminClient } from "@/lib/server/supabase";
import { CURRENT_2026_DRIVER_IDS, getCurrentDriverMeta } from "@/lib/ui/driver-asset-manifest";

type CsvRace = {
  id: string;
  season: string;
  round: string;
  race_name: string;
  scheduled_at: string;
};

type CsvRaceResult = {
  race_id: string;
  driver_id: string;
  constructor_id: string;
  finish_position: string;
  points: string;
};

type CsvSprintResult = {
  race_id: string;
  driver_id: string;
  constructor_id: string;
  finish_position: string;
  points: string;
};

type CsvDriver = {
  id: string;
  driver_code: string;
  first_name: string;
  last_name: string;
  full_name: string;
  nationality: string;
};

type CsvConstructor = {
  id: string;
  name: string;
};

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

type Dataset = {
  races: CsvRace[];
  raceResults: CsvRaceResult[];
  sprintResults: CsvSprintResult[];
  drivers: Map<string, CsvDriver>;
  constructors: Map<string, CsvConstructor>;
};

const loadCsvDataset = cache(async (): Promise<Dataset> => {
  const [races, raceResults, sprintResults, drivers, constructors] = await Promise.all([
    readCuratedCsv("races.csv") as Promise<CsvRace[]>,
    readCuratedCsv("race_results.csv") as Promise<CsvRaceResult[]>,
    readCuratedCsvOptional("sprint_results.csv") as Promise<CsvSprintResult[]>,
    readCuratedCsv("drivers.csv") as Promise<CsvDriver[]>,
    readCuratedCsv("constructors.csv") as Promise<CsvConstructor[]>,
  ]);

  return {
    races,
    raceResults,
    sprintResults,
    drivers: new Map(drivers.map((driver) => [driver.id, driver])),
    constructors: new Map(constructors.map((constructor) => [constructor.id, constructor])),
  };
});

export async function getCurrentSeasonDriverStandings(): Promise<CurrentSeasonDriverStandings | null> {
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    return getCurrentSeasonDriverStandingsFromSupabase();
  }

  return getCurrentSeasonDriverStandingsFromCsv();
}

async function getCurrentSeasonDriverStandingsFromCsv(): Promise<CurrentSeasonDriverStandings | null> {
  const dataset = await loadCsvDataset();
  const completedRaces = getCompletedRaces(
    dataset.races.map((race) => ({
      id: race.id,
      season: Number(race.season),
      round: Number(race.round),
      raceName: race.race_name,
      scheduledAt: race.scheduled_at,
    })),
    dataset.raceResults.map((result) => result.race_id),
  );

  if (completedRaces.length === 0) {
    return null;
  }

  const currentSeason = completedRaces[0].season;
  const seasonRaces = completedRaces.filter((race) => race.season === currentSeason);
  const latestRace = seasonRaces[0];
  const seasonRaceIds = new Set(seasonRaces.map((race) => race.id));

  return {
    season: currentSeason,
    latestRaceId: latestRace.id,
    latestRaceName: latestRace.raceName,
    latestRaceDate: latestRace.scheduledAt,
    items: buildStandings(
      dataset.raceResults.filter((row) => seasonRaceIds.has(row.race_id)),
      dataset.sprintResults.filter((row) => seasonRaceIds.has(row.race_id)),
      latestRace.id,
      dataset.drivers,
      dataset.constructors,
    ),
  };
}

async function getCurrentSeasonDriverStandingsFromSupabase(): Promise<CurrentSeasonDriverStandings | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return null;
  }

  const now = new Date().toISOString();
  const [racesResult, raceResultsResult, sprintResultsResult, driversResult, constructorsResult] = await Promise.all([
    supabase
      .from("races")
      .select("id, season, round, race_name, scheduled_at")
      .lte("scheduled_at", now)
      .order("season", { ascending: false })
      .order("round", { ascending: false }),
    supabase
      .from("race_results")
      .select("race_id, driver_id, constructor_id, finish_position, points"),
    supabase
      .from("sprint_results")
      .select("race_id, driver_id, constructor_id, finish_position, points"),
    supabase
      .from("drivers")
      .select("id, driver_code, first_name, last_name, full_name, nationality"),
    supabase.from("constructors").select("id, name"),
  ]);

  if (
    racesResult.error ||
    raceResultsResult.error ||
    driversResult.error ||
    constructorsResult.error ||
    (sprintResultsResult.error && !sprintResultsResult.error.message.includes("sprint_results"))
  ) {
    throw new Error("Failed to load current season driver standings.");
  }

  const completedRaces = getCompletedRaces(
    (racesResult.data ?? []).map((race) => ({
      id: race.id,
      season: race.season,
      round: race.round,
      raceName: race.race_name,
      scheduledAt: race.scheduled_at,
    })),
    (raceResultsResult.data ?? []).map((result) => String(result.race_id)),
  );

  if (completedRaces.length === 0) {
    return null;
  }

  const currentSeason = completedRaces[0].season;
  const seasonRaces = completedRaces.filter((race) => race.season === currentSeason);
  const latestRace = seasonRaces[0];
  const seasonRaceIds = new Set(seasonRaces.map((race) => race.id));
  const drivers = new Map(
    (driversResult.data ?? []).map((driver) => [
      driver.id,
      {
        id: driver.id,
        driver_code: driver.driver_code ?? "",
        first_name: driver.first_name,
        last_name: driver.last_name,
        full_name: driver.full_name,
        nationality: driver.nationality ?? "",
      },
    ]),
  );
  const constructors = new Map(
    (constructorsResult.data ?? []).map((constructor) => [constructor.id, { id: constructor.id, name: constructor.name }]),
  );

  return {
    season: currentSeason,
    latestRaceId: latestRace.id,
    latestRaceName: latestRace.raceName,
    latestRaceDate: latestRace.scheduledAt,
    items: buildStandings(
      (raceResultsResult.data ?? [])
        .filter((row) => seasonRaceIds.has(String(row.race_id)))
        .map((row) => ({
          race_id: String(row.race_id),
          driver_id: String(row.driver_id),
          constructor_id: String(row.constructor_id),
          finish_position: String(row.finish_position ?? ""),
          points: String(row.points ?? 0),
        })),
      (sprintResultsResult.data ?? [])
        .filter((row) => seasonRaceIds.has(String(row.race_id)))
        .map((row) => ({
          race_id: String(row.race_id),
          driver_id: String(row.driver_id),
          constructor_id: String(row.constructor_id),
          finish_position: String(row.finish_position ?? ""),
          points: String(row.points ?? 0),
        })),
      latestRace.id,
      drivers,
      constructors,
    ),
  };
}

function buildStandings(
  raceResults: CsvRaceResult[],
  sprintResults: CsvSprintResult[],
  latestRaceId: string,
  drivers: Map<string, CsvDriver>,
  constructors: Map<string, CsvConstructor>,
): DriverStanding[] {
  const standingMap = new Map<
    string,
    {
      driverId: string;
      points: number;
      bestFinish: number | null;
      latestRaceFinish: number | null;
      latestTeamId: string;
    }
  >();

  for (const driverId of CURRENT_2026_DRIVER_IDS) {
    const meta = getCurrentDriverMeta(driverId);
    standingMap.set(driverId, {
      driverId,
      points: 0,
      bestFinish: null,
      latestRaceFinish: null,
      latestTeamId: meta.teamId,
    });
  }

  for (const result of raceResults) {
    const current = standingMap.get(result.driver_id) ?? {
      driverId: result.driver_id,
      points: 0,
      bestFinish: null,
      latestRaceFinish: null,
      latestTeamId: result.constructor_id,
    };

    current.points += Number(result.points ?? 0);
    const finish = parseNumber(result.finish_position);
    if (finish !== null) {
      current.bestFinish = current.bestFinish === null ? finish : Math.min(current.bestFinish, finish);
      if (result.race_id === latestRaceId) {
        current.latestRaceFinish = finish;
      }
    }
    current.latestTeamId = result.constructor_id;
    standingMap.set(result.driver_id, current);
  }

  for (const sprint of sprintResults) {
    const current = standingMap.get(sprint.driver_id);
    if (!current) {
      continue;
    }
    current.points += Number(sprint.points ?? 0);
  }

  return [...standingMap.values()]
    .sort((left, right) => {
      if (right.points !== left.points) {
        return right.points - left.points;
      }

      const leftBest = left.bestFinish ?? 999;
      const rightBest = right.bestFinish ?? 999;
      if (leftBest !== rightBest) {
        return leftBest - rightBest;
      }

      const leftLatest = left.latestRaceFinish ?? 999;
      const rightLatest = right.latestRaceFinish ?? 999;
      if (leftLatest !== rightLatest) {
        return leftLatest - rightLatest;
      }

      const leftMeta = getCurrentDriverMeta(left.driverId);
      const rightMeta = getCurrentDriverMeta(right.driverId);
      const leftName = leftMeta.displayName ?? drivers.get(left.driverId)?.full_name ?? left.driverId;
      const rightName = rightMeta.displayName ?? drivers.get(right.driverId)?.full_name ?? right.driverId;
      return leftName.localeCompare(rightName);
    })
    .map((entry, index) => {
      const meta = getCurrentDriverMeta(entry.driverId);
      const driver = drivers.get(entry.driverId);
      const constructor = constructors.get(entry.latestTeamId);

      return {
        driverId: entry.driverId,
        firstName: meta.firstName || driver?.first_name || entry.driverId,
        lastName: meta.lastName || driver?.last_name || entry.driverId.replaceAll("_", " "),
        displayName: meta.displayName || driver?.full_name || entry.driverId.replaceAll("_", " "),
        teamId: meta.teamId || entry.latestTeamId,
        teamName: meta.currentTeamName || constructor?.name || entry.latestTeamId.replaceAll("_", " "),
        points: Number(entry.points.toFixed(0)),
        standingPosition: index + 1,
        code: meta.driverCode || driver?.driver_code || null,
        nationality: meta.nationality || driver?.nationality || null,
      };
    });
}

function getCompletedRaces(
  races: Array<{ id: string; season: number; round: number; raceName: string; scheduledAt: string }>,
  raceResultIds: string[],
) {
  const resultSet = new Set(raceResultIds);
  const now = Date.now();

  return races
    .filter((race) => new Date(race.scheduledAt).getTime() <= now && resultSet.has(race.id))
    .sort((left, right) => {
      if (right.season !== left.season) {
        return right.season - left.season;
      }

      return right.round - left.round;
    });
}
