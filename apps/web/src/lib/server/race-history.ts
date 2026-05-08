import { cache } from "react";
import { parseBoolean, parseNumber, readCsvFile, readOptionalCsvFile } from "@/lib/server/csv";
import { getRuntimeData, resolveRuntimeSource, type RuntimeSourceResult } from "@/lib/server/runtime-source";
import { getSupabasePublicClient } from "@/lib/server/supabase";
import { groupBy, roundTo } from "@/lib/server/utils";

export type RaceHistorySummary = {
  id: string;
  slug: string;
  season: number;
  round: number;
  grandPrixName: string;
  displayName: string;
  circuitId: string;
  circuitName: string;
  country: string | null;
  raceDate: string;
  winner: RaceActorSummary | null;
};

export type RaceActorSummary = {
  driverId: string;
  driverName: string;
  constructorId: string;
  constructorName: string;
};

export type RaceClassificationEntry = RaceActorSummary & {
  position: number | null;
  gridPosition: number | null;
  lapsCompleted: number | null;
  points: number;
  status: string | null;
  fastestLapRank: number | null;
};

export type ConstructorRaceResult = {
  constructorId: string;
  constructorName: string;
  totalPoints: number;
  bestFinish: number | null;
  drivers: string[];
};

export type RaceDetail = RaceHistorySummary & {
  officialName: string | null;
  sprintWeekend: boolean;
  circuit: {
    id: string;
    name: string;
    location: string | null;
    country: string | null;
    lat: number | null;
    lng: number | null;
  };
  podium: RaceActorSummary[];
  fastestLap: RaceActorSummary | null;
  pole: RaceActorSummary | null;
  qualifyingTopThree: RaceActorSummary[];
  classification: RaceClassificationEntry[];
  constructorResults: ConstructorRaceResult[];
  sprint: {
    classification: Array<
      RaceActorSummary & {
        position: number | null;
        gridPosition: number | null;
        points: number;
        status: string | null;
      }
    >;
  } | null;
};

export type RaceHistoryListResult = RuntimeSourceResult<RaceHistorySummary[]>;
export type RaceDetailResult = RuntimeSourceResult<RaceDetail>;

type CsvRace = {
  id: string;
  season: string;
  round: string;
  race_name: string;
  official_name: string;
  circuit_id: string;
  scheduled_at: string;
  sprint_weekend: string;
};

type CsvCircuit = {
  id: string;
  name: string;
  location: string;
  country: string;
  lat: string;
  lng: string;
};

type CsvDriver = {
  id: string;
  full_name: string;
};

type CsvConstructor = {
  id: string;
  name: string;
};

type CsvQualifyingResult = {
  race_id: string;
  driver_id: string;
  constructor_id: string;
  position: string;
};

type CsvRaceResult = {
  race_id: string;
  driver_id: string;
  constructor_id: string;
  grid_position: string;
  finish_position: string;
  finish_status: string;
  points: string;
  laps_completed: string;
  fastest_lap_rank: string;
};

type CsvSprintResult = {
  race_id: string;
  driver_id: string;
  constructor_id: string;
  grid_position: string;
  finish_position: string;
  finish_status: string;
  points: string;
};

type LookupMaps = {
  driverNames: Map<string, string>;
  constructorNames: Map<string, string>;
  circuits: Map<string, CsvCircuit>;
};

type CsvDataset = {
  races: CsvRace[];
  raceResults: CsvRaceResult[];
  qualifyingResults: CsvQualifyingResult[];
  sprintResults: CsvSprintResult[];
  lookups: LookupMaps;
};

type SupabaseRaceRow = {
  id: string;
  season: number;
  round: number;
  race_name: string;
  official_name: string | null;
  circuit_id: string;
  scheduled_at: string;
  sprint_weekend: boolean;
};

type SupabaseDriverRow = {
  id: string;
  full_name: string;
};

type SupabaseConstructorRow = {
  id: string;
  name: string;
};

type SupabaseCircuitRow = {
  id: string;
  name: string;
  location: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
};

type SupabaseRaceResultRow = {
  race_id: string;
  driver_id: string;
  constructor_id: string;
  grid_position: number | null;
  finish_position: number | null;
  finish_status: string | null;
  points: number | null;
  laps_completed: number | null;
  fastest_lap_rank: number | null;
};

type SupabaseQualifyingRow = {
  race_id: string;
  driver_id: string;
  constructor_id: string;
  position: number | null;
};

type SupabaseSprintRow = {
  race_id: string;
  driver_id: string;
  constructor_id: string;
  grid_position: number | null;
  finish_position: number | null;
  finish_status: string | null;
  points: number | null;
};

const loadCsvDataset = cache(async (): Promise<CsvDataset> => {
  const [races, raceResults, qualifyingResults, sprintResults, drivers, constructors, circuits] =
    await Promise.all([
      readCsvFile<CsvRace>("curated.races"),
      readCsvFile<CsvRaceResult>("curated.raceResults"),
      readCsvFile<CsvQualifyingResult>("curated.qualifyingResults"),
      readOptionalCsvFile<CsvSprintResult>("curated.sprintResults"),
      readCsvFile<CsvDriver>("curated.drivers"),
      readCsvFile<CsvConstructor>("curated.constructors"),
      readCsvFile<CsvCircuit>("curated.circuits"),
    ]);

  return {
    races,
    raceResults,
    qualifyingResults,
    sprintResults,
    lookups: {
      driverNames: new Map(drivers.map((driver) => [driver.id, driver.full_name])),
      constructorNames: new Map(constructors.map((constructor) => [constructor.id, constructor.name])),
      circuits: new Map(circuits.map((circuit) => [circuit.id, circuit])),
    },
  };
});

export const listCompletedRaceHistory = cache(async (limit = 16): Promise<RaceHistorySummary[]> => {
  const result = await listCompletedRaceHistoryResult(limit);
  return getRuntimeData(result) ?? [];
});

export const getRaceDetail = cache(async (raceId: string): Promise<RaceDetail | null> => {
  const result = await getRaceDetailResult(raceId);
  return getRuntimeData(result);
});

function describeHistoryList(items: RaceHistorySummary[]) {
  const latest = items[0] ?? null;
  return {
    eventId: latest?.id ?? null,
    season: latest?.season ?? null,
    round: latest?.round ?? null,
  };
}

function describeRaceDetail(detail: RaceDetail) {
  return {
    eventId: detail.id,
    season: detail.season,
    round: detail.round,
  };
}

export const listCompletedRaceHistoryResult = cache(async (limit = 16): Promise<RaceHistoryListResult> =>
  resolveRuntimeSource({
    surface: "reference",
    primary: {
      sourceKind: "database",
      sourceLabel: "canonical_tables",
      load: async () => {
        const supabase = getSupabasePublicClient();
        if (!supabase) {
          return null;
        }
        const items = await listCompletedRaceHistoryFromSupabase(limit);
        return items.length > 0 ? items : null;
      },
      describe: describeHistoryList,
    },
    degraded: {
      sourceKind: "csv-canonical",
      sourceLabel: "curated_csv",
      load: async () => {
        const items = await listCompletedRaceHistoryFromCsv(limit);
        return items.length > 0 ? items : null;
      },
      describe: describeHistoryList,
    },
  }),
);

export const getRaceDetailResult = cache(async (raceId: string): Promise<RaceDetailResult> =>
  resolveRuntimeSource({
    surface: "reference",
    primary: {
      sourceKind: "database",
      sourceLabel: "canonical_tables",
      load: async () => {
        const supabase = getSupabasePublicClient();
        if (!supabase) {
          return null;
        }
        return getRaceDetailFromSupabase(raceId);
      },
      describe: describeRaceDetail,
    },
    degraded: {
      sourceKind: "csv-canonical",
      sourceLabel: "curated_csv",
      load: () => getRaceDetailFromCsv(raceId),
      describe: describeRaceDetail,
    },
  }),
);

async function listCompletedRaceHistoryFromCsv(limit: number): Promise<RaceHistorySummary[]> {
  const dataset = await loadCsvDataset();
  const now = Date.now();
  const resultsByRace = groupBy(dataset.raceResults, (row) => row.race_id);

  return dataset.races
    .filter((race) => new Date(race.scheduled_at).getTime() <= now && (resultsByRace.get(race.id)?.length ?? 0) > 0)
    .sort((left, right) => new Date(right.scheduled_at).getTime() - new Date(left.scheduled_at).getTime())
    .slice(0, limit)
    .map((race) => buildSummary(race, resultsByRace.get(race.id) ?? [], dataset.lookups));
}

async function getRaceDetailFromCsv(raceId: string): Promise<RaceDetail | null> {
  const dataset = await loadCsvDataset();
  const race = dataset.races.find((item) => item.id === raceId);
  if (!race) {
    return null;
  }

  return buildDetail(
    race,
    dataset.raceResults.filter((row) => row.race_id === raceId),
    dataset.qualifyingResults.filter((row) => row.race_id === raceId),
    dataset.sprintResults.filter((row) => row.race_id === raceId),
    dataset.lookups,
  );
}

async function listCompletedRaceHistoryFromSupabase(limit: number): Promise<RaceHistorySummary[]> {
  const supabase = getSupabasePublicClient();
  if (!supabase) {
    return [];
  }

  const now = new Date().toISOString();
  const { data: races, error: racesError } = await supabase
    .from("races")
    .select("id, season, round, race_name, official_name, circuit_id, scheduled_at, sprint_weekend")
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: false })
    .limit(limit * 3);

  if (racesError) {
    throw new Error("Failed to load race history from Supabase.");
  }

  const raceRows = (races ?? []) as SupabaseRaceRow[];
  const raceIds = raceRows.map((race) => race.id);
  if (raceIds.length === 0) {
    return [];
  }

  const [raceResultsResult, driversResult, constructorsResult, circuitsResult] = await Promise.all([
    supabase
      .from("race_results")
      .select("race_id, driver_id, constructor_id, grid_position, finish_position, finish_status, points, laps_completed, fastest_lap_rank")
      .in("race_id", raceIds),
    supabase.from("drivers").select("id, full_name"),
    supabase.from("constructors").select("id, name"),
    supabase.from("circuits").select("id, name, location, country, lat, lng"),
  ]);

  if (
    raceResultsResult.error ||
    driversResult.error ||
    constructorsResult.error ||
    circuitsResult.error
  ) {
    throw new Error("Failed to load race history from Supabase.");
  }

  const driverRows = (driversResult.data ?? []) as SupabaseDriverRow[];
  const constructorRows = (constructorsResult.data ?? []) as SupabaseConstructorRow[];
  const circuitRows = (circuitsResult.data ?? []) as SupabaseCircuitRow[];
  const raceResultRows = (raceResultsResult.data ?? []) as SupabaseRaceResultRow[];

  const lookups: LookupMaps = {
    driverNames: new Map(driverRows.map((driver) => [driver.id, driver.full_name])),
    constructorNames: new Map(constructorRows.map((constructor) => [constructor.id, constructor.name])),
    circuits: new Map(
      circuitRows.map((circuit) => [
        circuit.id,
        {
          id: circuit.id,
          name: circuit.name,
          location: circuit.location ?? "",
          country: circuit.country ?? "",
          lat: String(circuit.lat ?? ""),
          lng: String(circuit.lng ?? ""),
        },
      ]),
    ),
  };

  const resultsByRace = groupBy(
    raceResultRows.map((row) => ({
      race_id: String(row.race_id),
      driver_id: String(row.driver_id),
      constructor_id: String(row.constructor_id),
      grid_position: String(row.grid_position ?? ""),
      finish_position: String(row.finish_position ?? ""),
      finish_status: row.finish_status ?? "",
      points: String(row.points ?? 0),
      laps_completed: String(row.laps_completed ?? ""),
      fastest_lap_rank: String(row.fastest_lap_rank ?? ""),
    })),
    (row) => row.race_id,
  );

  return raceRows
    .filter((race) => (resultsByRace.get(race.id)?.length ?? 0) > 0)
    .slice(0, limit)
    .map((race) =>
      buildSummary(
        {
          id: race.id,
          season: String(race.season),
          round: String(race.round),
          race_name: race.race_name,
          official_name: race.official_name ?? "",
          circuit_id: race.circuit_id,
          scheduled_at: race.scheduled_at,
          sprint_weekend: String(race.sprint_weekend),
        },
        resultsByRace.get(race.id) ?? [],
        lookups,
      ),
    );
}

async function getRaceDetailFromSupabase(raceId: string): Promise<RaceDetail | null> {
  const supabase = getSupabasePublicClient();
  if (!supabase) {
    return null;
  }

  const [raceResult, raceResultsResult, qualifyingResult, sprintResult, driversResult, constructorsResult, circuitsResult] =
    await Promise.all([
      supabase
        .from("races")
        .select("id, season, round, race_name, official_name, circuit_id, scheduled_at, sprint_weekend")
        .eq("id", raceId)
        .single(),
      supabase
        .from("race_results")
        .select("race_id, driver_id, constructor_id, grid_position, finish_position, finish_status, points, laps_completed, fastest_lap_rank")
        .eq("race_id", raceId),
      supabase
        .from("qualifying_results")
        .select("race_id, driver_id, constructor_id, position")
        .eq("race_id", raceId)
        .order("position"),
      supabase
        .from("sprint_results")
        .select("race_id, driver_id, constructor_id, grid_position, finish_position, finish_status, points")
        .eq("race_id", raceId),
      supabase.from("drivers").select("id, full_name"),
      supabase.from("constructors").select("id, name"),
      supabase.from("circuits").select("id, name, location, country, lat, lng"),
    ]);

  const typedRaceResult = raceResult as unknown as {
    data: SupabaseRaceRow | null;
    error: { message: string } | null;
  };

  if (typedRaceResult.error || !typedRaceResult.data) {
    return null;
  }

  if (raceResultsResult.error || qualifyingResult.error || driversResult.error || constructorsResult.error || circuitsResult.error) {
    throw new Error("Failed to load race detail from Supabase.");
  }

  const driverRows = (driversResult.data ?? []) as SupabaseDriverRow[];
  const constructorRows = (constructorsResult.data ?? []) as SupabaseConstructorRow[];
  const circuitRows = (circuitsResult.data ?? []) as SupabaseCircuitRow[];
  const raceResultRows = (raceResultsResult.data ?? []) as SupabaseRaceResultRow[];
  const qualifyingRows = (qualifyingResult.data ?? []) as SupabaseQualifyingRow[];
  const sprintResultRows = (sprintResult.data ?? []) as SupabaseSprintRow[];
  const typedRace = typedRaceResult.data;

  const lookups: LookupMaps = {
    driverNames: new Map(driverRows.map((driver) => [driver.id, driver.full_name])),
    constructorNames: new Map(constructorRows.map((constructor) => [constructor.id, constructor.name])),
    circuits: new Map(
      circuitRows.map((circuit) => [
        circuit.id,
        {
          id: circuit.id,
          name: circuit.name,
          location: circuit.location ?? "",
          country: circuit.country ?? "",
          lat: String(circuit.lat ?? ""),
          lng: String(circuit.lng ?? ""),
        },
      ]),
    ),
  };

  const sprintRows =
    sprintResult.error && sprintResult.error.message.includes("sprint_results")
      ? []
      : sprintResultRows.map((row) => ({
          race_id: String(row.race_id),
          driver_id: String(row.driver_id),
          constructor_id: String(row.constructor_id),
          grid_position: String(row.grid_position ?? ""),
          finish_position: String(row.finish_position ?? ""),
          finish_status: row.finish_status ?? "",
          points: String(row.points ?? 0),
        }));

  return buildDetail(
    {
      id: typedRace.id,
      season: String(typedRace.season),
      round: String(typedRace.round),
      race_name: typedRace.race_name,
      official_name: typedRace.official_name ?? "",
      circuit_id: typedRace.circuit_id,
      scheduled_at: typedRace.scheduled_at,
      sprint_weekend: String(typedRace.sprint_weekend),
    },
    raceResultRows.map((row) => ({
      race_id: String(row.race_id),
      driver_id: String(row.driver_id),
      constructor_id: String(row.constructor_id),
      grid_position: String(row.grid_position ?? ""),
      finish_position: String(row.finish_position ?? ""),
      finish_status: row.finish_status ?? "",
      points: String(row.points ?? 0),
      laps_completed: String(row.laps_completed ?? ""),
      fastest_lap_rank: String(row.fastest_lap_rank ?? ""),
    })),
    qualifyingRows.map((row) => ({
      race_id: String(row.race_id),
      driver_id: String(row.driver_id),
      constructor_id: String(row.constructor_id),
      position: String(row.position ?? ""),
    })),
    sprintRows,
    lookups,
  );
}

function buildSummary(race: CsvRace, results: CsvRaceResult[], lookups: LookupMaps): RaceHistorySummary {
  const circuit = lookups.circuits.get(race.circuit_id);
  const winnerRow = results
    .filter((row) => parseNumber(row.finish_position) !== null)
    .sort((left, right) => (parseNumber(left.finish_position) ?? 999) - (parseNumber(right.finish_position) ?? 999))[0];

  return {
    id: race.id,
    slug: race.id,
    season: Number(race.season),
    round: Number(race.round),
    grandPrixName: race.race_name,
    displayName: race.race_name,
    circuitId: race.circuit_id,
    circuitName: circuit?.name ?? race.circuit_id,
    country: circuit?.country || null,
    raceDate: race.scheduled_at,
    winner: winnerRow ? mapActor(winnerRow.driver_id, winnerRow.constructor_id, lookups) : null,
  };
}

function buildDetail(
  race: CsvRace,
  raceResults: CsvRaceResult[],
  qualifyingResults: CsvQualifyingResult[],
  sprintResults: CsvSprintResult[],
  lookups: LookupMaps,
): RaceDetail {
  const summary = buildSummary(race, raceResults, lookups);
  const circuit = lookups.circuits.get(race.circuit_id);
  const classification = raceResults
    .slice()
    .sort((left, right) => (parseNumber(left.finish_position) ?? 999) - (parseNumber(right.finish_position) ?? 999))
    .map((row) => ({
      ...mapActor(row.driver_id, row.constructor_id, lookups),
      position: parseNumber(row.finish_position),
      gridPosition: parseNumber(row.grid_position),
      points: Number(row.points ?? 0),
      lapsCompleted: parseNumber(row.laps_completed),
      status: row.finish_status || null,
      fastestLapRank: parseNumber(row.fastest_lap_rank),
    }));

  const podium = classification.slice(0, 3).map(stripClassificationEntry);
  const fastestLapEntry = classification.find((entry) => entry.fastestLapRank === 1);
  const poleTopThree = qualifyingResults
    .slice()
    .sort((left, right) => (parseNumber(left.position) ?? 999) - (parseNumber(right.position) ?? 999))
    .slice(0, 3)
    .map((row) => mapActor(row.driver_id, row.constructor_id, lookups));

  const constructorResults = [...groupBy(classification, (entry) => entry.constructorId).entries()]
    .map(([constructorId, entries]) => ({
      constructorId,
      constructorName: entries[0]?.constructorName ?? constructorId,
      totalPoints: roundTo(entries.reduce((total, entry) => total + entry.points, 0), 1),
      bestFinish: entries.reduce<number | null>((best, entry) => {
        if (entry.position === null) {
          return best;
        }
        if (best === null) {
          return entry.position;
        }
        return Math.min(best, entry.position);
      }, null),
      drivers: entries.map((entry) => entry.driverName),
    }))
    .sort((left, right) => right.totalPoints - left.totalPoints || (left.bestFinish ?? 999) - (right.bestFinish ?? 999));

  const sprintClassification =
    sprintResults.length > 0
      ? sprintResults
          .slice()
          .sort((left, right) => (parseNumber(left.finish_position) ?? 999) - (parseNumber(right.finish_position) ?? 999))
          .map((row) => ({
            ...mapActor(row.driver_id, row.constructor_id, lookups),
            position: parseNumber(row.finish_position),
            gridPosition: parseNumber(row.grid_position),
            points: Number(row.points ?? 0),
            status: row.finish_status || null,
          }))
      : null;

  return {
    ...summary,
    officialName: race.official_name || null,
    sprintWeekend: parseBoolean(race.sprint_weekend),
    circuit: {
      id: race.circuit_id,
      name: circuit?.name ?? race.circuit_id,
      location: circuit?.location || null,
      country: circuit?.country || null,
      lat: parseNumber(circuit?.lat),
      lng: parseNumber(circuit?.lng),
    },
    podium,
    fastestLap: fastestLapEntry ? stripClassificationEntry(fastestLapEntry) : null,
    pole: poleTopThree[0] ?? null,
    qualifyingTopThree: poleTopThree,
    classification,
    constructorResults,
    sprint: sprintClassification ? { classification: sprintClassification } : null,
  };
}

function mapActor(driverId: string, constructorId: string, lookups: LookupMaps): RaceActorSummary {
  return {
    driverId,
    driverName: lookups.driverNames.get(driverId) ?? driverId,
    constructorId,
    constructorName: lookups.constructorNames.get(constructorId) ?? constructorId,
  };
}

function stripClassificationEntry(entry: RaceClassificationEntry): RaceActorSummary {
  return {
    driverId: entry.driverId,
    driverName: entry.driverName,
    constructorId: entry.constructorId,
    constructorName: entry.constructorName,
  };
}
