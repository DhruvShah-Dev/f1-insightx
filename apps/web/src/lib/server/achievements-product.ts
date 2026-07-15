import { cache } from "react";
import { parseNumber, readOptionalCsvFile, type CsvFileKey } from "@/lib/server/csv";
import { isTestRun } from "@/lib/server/data-paths";
import { getCurrentDriverMeta } from "@/lib/ui/driver-asset-manifest";

type Numeric = number | string | null | undefined;

type RaceAnalysisIndexRow = {
  race_analysis_id: string;
  season: Numeric;
  generated_at: string;
};

type RaceRow = {
  id: string;
  season: Numeric;
};

type RaceResultRow = {
  race_id: string;
  driver_id: string;
  constructor_id: string;
  finish_status: string;
  laps_completed: Numeric;
};

type DriverRow = {
  id: string;
  driver_code: string;
  full_name: string;
};

type ConstructorRow = {
  id: string;
  name: string;
};

type PositionTimelineRow = {
  race_analysis_id: string;
  driver: string;
  team: string;
  position: Numeric;
};

type PositionChangeRow = {
  race_analysis_id: string;
  driver: string;
  team: string;
  net_position_change: Numeric;
  positions_gained_on_track_proxy: Numeric;
};

type PitStrategyRow = {
  race_analysis_id: string;
  driver: string;
  team: string;
};

const achievementTableMap = {
  analysisIndex: "race_analysis_index",
  races: "races",
  raceResults: "race_results",
  drivers: "drivers",
  constructors: "constructors",
  positionTimeline: "race_analysis_position_timeline",
  positionChanges: "race_analysis_position_changes",
  pitStrategy: "race_analysis_pit_strategy",
} as const;

async function readSupabaseRows<T>(table: string) {
  const supabase = isTestRun()
    ? null
    : (await import("@/lib/server/supabase")).getSupabasePublicClient();
  if (!supabase) {
    return null;
  }

  const pageSize = 1000;
  const rows: unknown[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from(table).select("*").range(from, from + pageSize - 1);
    if (error) {
      return null;
    }

    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) {
      break;
    }
  }

  if (!rows.length) {
    return null;
  }

  return rows as T[];
}

async function readAchievementRows<T>(tableKey: keyof typeof achievementTableMap, csvKey: CsvFileKey) {
  return (await readSupabaseRows<T>(achievementTableMap[tableKey])) ?? readOptionalCsvFile<T>(csvKey);
}

export type AchievementMetricId =
  | "lapsCompleted"
  | "lapsLed"
  | "overtakes"
  | "pitStops"
  | "positionsGained"
  | "positionsLost"
  | "dnfs";

export type AchievementEntry = {
  driverCode: string;
  driverName: string;
  teamName: string;
  value: number;
  rank: number;
};

export type AchievementMetric = {
  id: AchievementMetricId;
  title: string;
  unit: string;
  sourceLabel: string;
  description: string;
  entries: AchievementEntry[];
};

export type AchievementsSeason = {
  season: number;
  raceCount: number;
  generatedAt: string | null;
  metrics: Record<AchievementMetricId, AchievementMetric>;
};

type DriverIdentity = {
  driverCode: string;
  driverName: string;
  teamName: string;
};

type DriverAccumulator = DriverIdentity & {
  value: number;
};

function num(value: Numeric) {
  return parseNumber(value === null || value === undefined ? undefined : String(value));
}

function normalizeCode(value: string | null | undefined) {
  return (value || "").trim().toUpperCase();
}

function driverNameFromCode(code: string) {
  return code || "Unknown driver";
}

function driverCodeFromId(driverId: string, driver?: DriverRow) {
  const csvCode = normalizeCode(driver?.driver_code);
  if (csvCode) {
    return csvCode;
  }

  const metaCode = normalizeCode(getCurrentDriverMeta(driverId).driverCode);
  if (metaCode && metaCode !== "DRV") {
    return metaCode;
  }

  return normalizeCode(driverId);
}

function driverIdentityFromId(driverId: string, driver?: DriverRow) {
  const meta = getCurrentDriverMeta(driverId);
  const driverCode = driverCodeFromId(driverId, driver);
  const driverName = driver?.full_name || (meta.displayName !== "Driver" ? meta.displayName : driverNameFromCode(driverCode));

  return { driverCode, driverName };
}

function createAccumulator(identity: DriverIdentity, value = 0): DriverAccumulator {
  return {
    driverCode: identity.driverCode,
    driverName: identity.driverName || driverNameFromCode(identity.driverCode),
    teamName: identity.teamName || "Team unavailable",
    value,
  };
}

function addToAccumulator(
  accumulators: Map<string, DriverAccumulator>,
  identity: DriverIdentity,
  amount: number,
) {
  if (!Number.isFinite(amount) || amount <= 0) {
    return;
  }

  const code = normalizeCode(identity.driverCode);
  if (!code) {
    return;
  }

  const current = accumulators.get(code) ?? createAccumulator({ ...identity, driverCode: code });
  current.value += amount;
  current.driverName = identity.driverName || current.driverName;
  current.teamName = identity.teamName || current.teamName;
  accumulators.set(code, current);
}

function rankEntries(accumulators: Map<string, DriverAccumulator>): AchievementEntry[] {
  return [...accumulators.values()]
    .filter((entry) => entry.value > 0)
    .sort((left, right) => right.value - left.value || left.driverName.localeCompare(right.driverName))
    .map((entry, index) => ({
      driverCode: entry.driverCode,
      driverName: entry.driverName,
      teamName: entry.teamName,
      value: Number.isInteger(entry.value) ? entry.value : Number(entry.value.toFixed(1)),
      rank: index + 1,
    }));
}

function metric(
  id: AchievementMetricId,
  title: string,
  unit: string,
  sourceLabel: string,
  description: string,
  accumulators: Map<string, DriverAccumulator>,
): AchievementMetric {
  return {
    id,
    title,
    unit,
    sourceLabel,
    description,
    entries: rankEntries(accumulators),
  };
}

function isDnfStatus(status: string) {
  return ["retired", "did not start", "disqualified"].includes(status.trim().toLowerCase());
}

const loadAchievementRows = cache(async () => {
  const [
    analysisIndex,
    races,
    raceResults,
    drivers,
    constructors,
    positionTimeline,
    positionChanges,
    pitStrategy,
  ] = await Promise.all([
    readAchievementRows<RaceAnalysisIndexRow>("analysisIndex", "raceAnalysis.index"),
    readAchievementRows<RaceRow>("races", "curated.races"),
    readAchievementRows<RaceResultRow>("raceResults", "curated.raceResults"),
    readAchievementRows<DriverRow>("drivers", "curated.drivers"),
    readAchievementRows<ConstructorRow>("constructors", "curated.constructors"),
    readAchievementRows<PositionTimelineRow>("positionTimeline", "raceAnalysis.positionTimeline"),
    readAchievementRows<PositionChangeRow>("positionChanges", "raceAnalysis.positionChanges"),
    readAchievementRows<PitStrategyRow>("pitStrategy", "raceAnalysis.pitStrategy"),
  ]);

  return {
    analysisIndex,
    races,
    raceResults,
    drivers,
    constructors,
    positionTimeline,
    positionChanges,
    pitStrategy,
  };
});

export const listAchievementSeasons = cache(async (): Promise<number[]> => {
  const { analysisIndex } = await loadAchievementRows();
  return [...new Set(analysisIndex.map((row) => num(row.season)).filter((season): season is number => season !== null))]
    .sort((left, right) => right - left);
});

export const getAchievementsSeason = cache(async (season?: number): Promise<AchievementsSeason | null> => {
  const rows = await loadAchievementRows();
  const seasons = await listAchievementSeasons();
  const selectedSeason = season && seasons.includes(season) ? season : seasons[0];
  if (!selectedSeason) {
    return null;
  }

  const raceIdsForSeason = new Set(
    rows.races
      .filter((race) => num(race.season) === selectedSeason)
      .map((race) => race.id),
  );
  const analysisRowsForSeason = rows.analysisIndex.filter((row) => num(row.season) === selectedSeason);
  const analysisIdsForSeason = new Set(analysisRowsForSeason.map((row) => row.race_analysis_id));
  const generatedAt = analysisRowsForSeason
    .map((row) => row.generated_at)
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;

  const driversById = new Map(rows.drivers.map((driver) => [driver.id, driver]));
  const driverNamesByCode = new Map(
    rows.drivers
      .filter((driver) => driver.driver_code)
      .map((driver) => [normalizeCode(driver.driver_code), driver.full_name]),
  );
  const constructorNames = new Map(rows.constructors.map((constructor) => [constructor.id, constructor.name]));

  const lapsCompleted = new Map<string, DriverAccumulator>();
  const lapsLed = new Map<string, DriverAccumulator>();
  const overtakes = new Map<string, DriverAccumulator>();
  const pitStops = new Map<string, DriverAccumulator>();
  const positionsGained = new Map<string, DriverAccumulator>();
  const positionsLost = new Map<string, DriverAccumulator>();
  const dnfs = new Map<string, DriverAccumulator>();

  for (const row of rows.raceResults) {
    if (!raceIdsForSeason.has(row.race_id)) {
      continue;
    }

    const driver = driversById.get(row.driver_id);
    const identity = driverIdentityFromId(row.driver_id, driver);
    addToAccumulator(lapsCompleted, {
      driverCode: identity.driverCode,
      driverName: identity.driverName,
      teamName: constructorNames.get(row.constructor_id) ?? row.constructor_id,
    }, num(row.laps_completed) ?? 0);

    if (isDnfStatus(row.finish_status)) {
      addToAccumulator(dnfs, {
        driverCode: identity.driverCode,
        driverName: identity.driverName,
        teamName: constructorNames.get(row.constructor_id) ?? row.constructor_id,
      }, 1);
    }
  }

  for (const row of rows.positionTimeline) {
    if (!analysisIdsForSeason.has(row.race_analysis_id) || num(row.position) !== 1) {
      continue;
    }

    const driverCode = normalizeCode(row.driver);
    addToAccumulator(lapsLed, {
      driverCode,
      driverName: driverNamesByCode.get(driverCode) ?? driverNameFromCode(driverCode),
      teamName: row.team,
    }, 1);
  }

  for (const row of rows.positionChanges) {
    if (!analysisIdsForSeason.has(row.race_analysis_id)) {
      continue;
    }

    const driverCode = normalizeCode(row.driver);
    const netPositionChange = num(row.net_position_change) ?? 0;
    const identity = {
      driverCode,
      driverName: driverNamesByCode.get(driverCode) ?? driverNameFromCode(driverCode),
      teamName: row.team,
    };

    addToAccumulator(overtakes, {
      driverCode,
      driverName: driverNamesByCode.get(driverCode) ?? driverNameFromCode(driverCode),
      teamName: row.team,
    }, Math.max(0, num(row.positions_gained_on_track_proxy) ?? 0));

    addToAccumulator(positionsGained, identity, Math.max(0, netPositionChange));
    addToAccumulator(positionsLost, identity, Math.max(0, -netPositionChange));
  }

  for (const row of rows.pitStrategy) {
    if (!analysisIdsForSeason.has(row.race_analysis_id)) {
      continue;
    }

    const driverCode = normalizeCode(row.driver);
    addToAccumulator(pitStops, {
      driverCode,
      driverName: driverNamesByCode.get(driverCode) ?? driverNameFromCode(driverCode),
      teamName: row.team,
    }, 1);
  }

  return {
    season: selectedSeason,
    raceCount: analysisIdsForSeason.size,
    generatedAt,
    metrics: {
      lapsCompleted: metric(
        "lapsCompleted",
        "Most laps completed",
        "laps",
        "Official race classification",
        "Total classified race laps completed in the selected season.",
        lapsCompleted,
      ),
      lapsLed: metric(
        "lapsLed",
        "Most laps led",
        "laps",
        "Lap-position timeline",
        "Laps where the driver is recorded in position 1.",
        lapsLed,
      ),
      overtakes: metric(
        "overtakes",
        "Most overtakes",
        "position gains",
        "Proxy / inferred",
        "Positive on-track position-gain proxy from race-analysis movement data.",
        overtakes,
      ),
      pitStops: metric(
        "pitStops",
        "Most pit stops",
        "stops",
        "Pit strategy rows",
        "Count of pit-stop events in race-analysis pit strategy data.",
        pitStops,
      ),
      positionsGained: metric(
        "positionsGained",
        "Most positions gained",
        "places",
        "Classification delta",
        "Positive start-to-finish position change in the selected season.",
        positionsGained,
      ),
      positionsLost: metric(
        "positionsLost",
        "Most positions lost",
        "places",
        "Classification delta",
        "Absolute negative start-to-finish position change in the selected season.",
        positionsLost,
      ),
      dnfs: metric(
        "dnfs",
        "Most DNFs",
        "DNFs",
        "Race classification",
        "Race entries marked Retired, Did not start, or Disqualified.",
        dnfs,
      ),
    },
  };
});

export const __achievementTestUtils = {
  isDnfStatus,
};
