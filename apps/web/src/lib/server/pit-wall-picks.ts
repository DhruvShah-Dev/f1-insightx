import "server-only";

import { createHash } from "node:crypto";
import { cache } from "react";
import {
  deterministicRandomPositions,
  validateNoDuplicateGroups,
  type PitWallPickPayloadInput,
} from "@/lib/pit-wall-picks/scoring";
import { readOptionalCsvFile, parseNumber } from "@/lib/server/csv";
import { getSupabasePrivilegedClient } from "@/lib/server/supabase";
import { getSeasonState } from "@/lib/server/season-state";
import { CURRENT_2026_DRIVER_IDS, getCurrentDriverMeta } from "@/lib/ui/driver-asset-manifest";

type SupabaseClient = NonNullable<ReturnType<typeof getSupabasePrivilegedClient>>;

export type PitWallDriver = {
  id: string;
  code: string | null;
  name: string;
};

export type PitWallRace = {
  id: string;
  season: number;
  round: number;
  raceName: string;
  scheduledAt: string;
};

export type PitWallChallenge = {
  raceId: string;
  season: number;
  round: number;
  qualifyingLockAt: string;
  randomPositions: [number, number, number];
};

export type PitWallPickEntry = {
  raceId: string;
  qualifyingTop3: [string, string, string];
  raceTop3: [string, string, string];
  randomDrivers: [string, string, string];
  fastestPitStopDriverId: string;
  fastestLapDriverId: string;
  submittedAt?: string;
  updatedAt?: string;
};

export type PitWallScoreBreakdown = {
  qualifying: Array<{ label: string; points: number | null }>;
  race: Array<{ label: string; points: number | null }>;
  specials: Array<{ label: string; points: number | null }>;
  totalPoints: number;
  pending: boolean;
};

export type PitWallLeaderboardEntry = {
  userId: string;
  username: string;
  points: number;
  racesEntered?: number;
};

export type PitWallRaceHistoryEntry = {
  raceId: string;
  season: number;
  round: number;
  raceName: string;
  points: number;
};

export type PitWallPayload = {
  configured: boolean;
  persistenceAvailable: boolean;
  runtimeMode: "database" | "csv-fallback" | "unavailable";
  authenticated: boolean;
  race: PitWallRace | null;
  challenge: PitWallChallenge | null;
  isLocked: boolean;
  lockStatusLabel: string;
  drivers: PitWallDriver[];
  userPick: PitWallPickEntry | null;
  userScore: PitWallScoreBreakdown | null;
  raceLeaderboard: PitWallLeaderboardEntry[];
  overallLeaderboard: PitWallLeaderboardEntry[];
  raceHistory: PitWallRaceHistoryEntry[];
};

type RaceRow = {
  id: string;
  season: number;
  round: number;
  race_name: string;
  scheduled_at: string;
};

type CsvRaceRow = {
  id: string;
  season: string;
  round: string;
  race_name: string;
  scheduled_at: string;
};

type CsvChallengeRow = {
  race_id: string;
  season: string;
  round: string;
  qualifying_lock_at: string;
  random_position_1: string;
  random_position_2: string;
  random_position_3: string;
};

type CsvDriverRow = {
  id: string;
  driver_code: string;
  full_name: string;
};

type CsvPredictionRow = {
  race_id: string;
  driver_id: string;
  projected_finish: string;
};

type ChallengeRow = {
  race_id: string;
  season: number;
  round: number;
  qualifying_lock_at: string;
  random_position_1: number;
  random_position_2: number;
  random_position_3: number;
};

type DriverRow = {
  id: string;
  driver_code: string | null;
  full_name: string;
};

type PickRow = {
  race_id: string;
  qualifying_p1_driver_id: string;
  qualifying_p2_driver_id: string;
  qualifying_p3_driver_id: string;
  race_p1_driver_id: string;
  race_p2_driver_id: string;
  race_p3_driver_id: string;
  random_position_1_driver_id: string;
  random_position_2_driver_id: string;
  random_position_3_driver_id: string;
  fastest_pit_stop_driver_id: string;
  fastest_lap_driver_id: string;
  submitted_at: string;
  updated_at: string;
};

type ScoreRow = {
  user_id: string;
  username: string | null;
  race_id: string;
  season: number;
  round: number;
  qualifying_p1_points: number | null;
  qualifying_p2_points: number | null;
  qualifying_p3_points: number | null;
  race_p1_points: number | null;
  race_p2_points: number | null;
  race_p3_points: number | null;
  random_position_1_points: number | null;
  random_position_2_points: number | null;
  random_position_3_points: number | null;
  fastest_pit_stop_points: number | null;
  fastest_lap_points: number | null;
  total_points: number;
};

type OverallScoreRow = {
  user_id: string;
  username: string;
  races_entered: number;
  total_points: number;
};

function mapRace(row: RaceRow): PitWallRace {
  return {
    id: row.id,
    season: row.season,
    round: row.round,
    raceName: row.race_name,
    scheduledAt: row.scheduled_at,
  };
}

function mapChallenge(row: ChallengeRow): PitWallChallenge {
  return {
    raceId: row.race_id,
    season: row.season,
    round: row.round,
    qualifyingLockAt: row.qualifying_lock_at,
    randomPositions: [row.random_position_1, row.random_position_2, row.random_position_3],
  };
}

function mapPick(row: PickRow): PitWallPickEntry {
  return {
    raceId: row.race_id,
    qualifyingTop3: [row.qualifying_p1_driver_id, row.qualifying_p2_driver_id, row.qualifying_p3_driver_id],
    raceTop3: [row.race_p1_driver_id, row.race_p2_driver_id, row.race_p3_driver_id],
    randomDrivers: [row.random_position_1_driver_id, row.random_position_2_driver_id, row.random_position_3_driver_id],
    fastestPitStopDriverId: row.fastest_pit_stop_driver_id,
    fastestLapDriverId: row.fastest_lap_driver_id,
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
  };
}

function emptyPayload(authenticated: boolean): PitWallPayload {
  return {
    configured: false,
    persistenceAvailable: false,
    runtimeMode: "unavailable",
    authenticated,
    race: null,
    challenge: null,
    isLocked: false,
    lockStatusLabel: "Unavailable",
    drivers: [],
    userPick: null,
    userScore: null,
    raceLeaderboard: [],
    overallLeaderboard: [],
    raceHistory: [],
  };
}

function mapCsvRace(row: CsvRaceRow): PitWallRace {
  return {
    id: row.id,
    season: Number(row.season),
    round: Number(row.round),
    raceName: row.race_name,
    scheduledAt: row.scheduled_at,
  };
}

function mapCsvChallenge(row: CsvChallengeRow): PitWallChallenge {
  return {
    raceId: row.race_id,
    season: Number(row.season),
    round: Number(row.round),
    qualifyingLockAt: row.qualifying_lock_at,
    randomPositions: [
      Number(row.random_position_1),
      Number(row.random_position_2),
      Number(row.random_position_3),
    ],
  };
}

function scoreBreakdown(row: ScoreRow, randomPositions: [number, number, number]): PitWallScoreBreakdown {
  const qualifying = [
    { label: "Qualifying P1", points: row.qualifying_p1_points },
    { label: "Qualifying P2", points: row.qualifying_p2_points },
    { label: "Qualifying P3", points: row.qualifying_p3_points },
  ];
  const race = [
    { label: "Race P1", points: row.race_p1_points },
    { label: "Race P2", points: row.race_p2_points },
    { label: "Race P3", points: row.race_p3_points },
    { label: `Race P${randomPositions[0]}`, points: row.random_position_1_points },
    { label: `Race P${randomPositions[1]}`, points: row.random_position_2_points },
    { label: `Race P${randomPositions[2]}`, points: row.random_position_3_points },
  ];
  const specials = [
    { label: "Fastest pit stop", points: row.fastest_pit_stop_points },
    { label: "Fastest lap", points: row.fastest_lap_points },
  ];

  return {
    qualifying,
    race,
    specials,
    totalPoints: Number(row.total_points ?? 0),
    pending: [...qualifying, ...race, ...specials].some((entry) => entry.points === null),
  };
}

function usernameFor(row: { user_id: string; username?: string | null }) {
  return row.username || `driver_${row.user_id.slice(0, 8)}`;
}

function publicLeaderboardKey(userId: string) {
  return `user_${createHash("sha256").update(userId).digest("hex").slice(0, 16)}`;
}

function isMissingPitWallTableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("race_pick_challenges") ||
    message.includes("user_race_picks") ||
    message.includes("race_pick_scores") ||
    message.includes("race_pick_overall_scores") ||
    message.includes("race_pit_stop_results")
  ) && /does not exist|not found|schema cache|Could not find/i.test(message);
}

async function getActiveRace(supabase: SupabaseClient): Promise<PitWallRace | null> {
  const seasonState = await getSeasonState();
  const targetRaceId = seasonState?.next_race?.id ?? seasonState?.current_race_week.race?.id;

  if (targetRaceId) {
    const { data, error } = await supabase
      .from("races")
      .select("id, season, round, race_name, scheduled_at")
      .eq("id", targetRaceId)
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to load Picks race: ${error.message}`);
    }
    if (data) {
      return mapRace(data as RaceRow);
    }
  }

  const { data, error } = await supabase
    .from("races")
    .select("id, season, round, race_name, scheduled_at")
    .gte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to load next Picks race: ${error.message}`);
  }

  return data ? mapRace(data as RaceRow) : null;
}

async function getChallenge(supabase: SupabaseClient, race: PitWallRace): Promise<PitWallChallenge | null> {
  const { data, error } = await supabase
    .from("race_pick_challenges")
    .select("race_id, season, round, qualifying_lock_at, random_position_1, random_position_2, random_position_3")
    .eq("race_id", race.id)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to load Picks challenge: ${error.message}`);
  }
  if (data) {
    return mapChallenge(data as ChallengeRow);
  }

  const fallbackPositions = deterministicRandomPositions(race.id);
  const fallbackLock = new Date(new Date(race.scheduledAt).getTime() - 24 * 60 * 60 * 1000).toISOString();
  return {
    raceId: race.id,
    season: race.season,
    round: race.round,
    qualifyingLockAt: fallbackLock,
    randomPositions: fallbackPositions,
  };
}

async function getDrivers(supabase: SupabaseClient, raceId: string): Promise<PitWallDriver[]> {
  const { data: predictionRows } = await supabase
    .from("prediction_snapshots")
    .select("driver_id")
    .eq("race_id", raceId)
    .order("projected_finish", { ascending: true });

  const predictionDriverIds = [...new Set(((predictionRows ?? []) as Array<{ driver_id: string }>).map((row) => row.driver_id))];
  let query = supabase.from("drivers").select("id, driver_code, full_name").order("last_name").order("first_name");
  if (predictionDriverIds.length > 0) {
    query = query.in("id", predictionDriverIds);
  }
  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load Picks drivers: ${error.message}`);
  }

  const drivers = ((data ?? []) as DriverRow[]).map((row) => ({
    id: row.id,
    code: row.driver_code,
    name: row.full_name,
  }));

  if (predictionDriverIds.length === 0) {
    return drivers.slice(0, 24);
  }

  const driverById = new Map(drivers.map((driver) => [driver.id, driver]));
  return predictionDriverIds.map((driverId) => driverById.get(driverId)).filter((driver): driver is PitWallDriver => Boolean(driver));
}

async function getUserPick(supabase: SupabaseClient, raceId: string, userId: string | null): Promise<PitWallPickEntry | null> {
  if (!userId) {
    return null;
  }
  const { data, error } = await supabase
    .from("user_race_picks")
    .select("*")
    .eq("race_id", raceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to load user Picks entry: ${error.message}`);
  }
  return data ? mapPick(data as PickRow) : null;
}

async function getLeaderboards(supabase: SupabaseClient, raceId: string) {
  const [raceResult, overallResult] = await Promise.all([
    supabase
      .from("race_pick_scores")
      .select("user_id, username, total_points")
      .eq("race_id", raceId)
      .order("total_points", { ascending: false })
      .limit(20),
    supabase
      .from("race_pick_overall_scores")
      .select("user_id, username, races_entered, total_points")
      .order("total_points", { ascending: false })
      .limit(20),
  ]);

  if (raceResult.error || overallResult.error) {
    throw new Error(`Failed to load Picks leaderboards: ${raceResult.error?.message ?? overallResult.error?.message}`);
  }

  return {
    raceLeaderboard: ((raceResult.data ?? []) as Array<{ user_id: string; username: string | null; total_points: number }>).map((row) => ({
      userId: publicLeaderboardKey(row.user_id),
      username: usernameFor(row),
      points: Number(row.total_points ?? 0),
    })),
    overallLeaderboard: ((overallResult.data ?? []) as OverallScoreRow[]).map((row) => ({
      userId: publicLeaderboardKey(row.user_id),
      username: usernameFor(row),
      points: Number(row.total_points ?? 0),
      racesEntered: Number(row.races_entered ?? 0),
    })),
  };
}

async function getUserScoreAndHistory(supabase: SupabaseClient, userId: string | null, raceId: string, randomPositions: [number, number, number]) {
  if (!userId) {
    return { userScore: null, raceHistory: [] };
  }

  const { data, error } = await supabase
    .from("race_pick_scores")
    .select("*")
    .eq("user_id", userId)
    .order("season", { ascending: false })
    .order("round", { ascending: false });
  if (error) {
    throw new Error(`Failed to load Picks score: ${error.message}`);
  }

  const rows = (data ?? []) as ScoreRow[];
  const raceIds = rows.map((row) => row.race_id);
  const raceNames = new Map<string, string>();
  if (raceIds.length > 0) {
    const { data: races } = await supabase.from("races").select("id, race_name").in("id", raceIds);
    for (const race of (races ?? []) as Array<{ id: string; race_name: string }>) {
      raceNames.set(race.id, race.race_name);
    }
  }

  const activeScore = rows.find((row) => row.race_id === raceId);
  return {
    userScore: activeScore ? scoreBreakdown(activeScore, randomPositions) : null,
    raceHistory: rows.map((row) => ({
      raceId: row.race_id,
      season: row.season,
      round: row.round,
      raceName: raceNames.get(row.race_id) ?? `Round ${row.round}`,
      points: Number(row.total_points ?? 0),
    })),
  };
}

async function getActiveRaceFromCsv(): Promise<PitWallRace | null> {
  const [seasonState, races] = await Promise.all([
    getSeasonState(),
    readOptionalCsvFile<CsvRaceRow>("curated.races"),
  ]);
  const targetRaceId = seasonState?.next_race?.id ?? seasonState?.current_race_week.race?.id;
  const targetRace = targetRaceId ? races.find((race) => race.id === targetRaceId) : null;
  if (targetRace) {
    return mapCsvRace(targetRace);
  }

  const now = Date.now();
  const nextRace = races
    .filter((race) => new Date(race.scheduled_at).getTime() >= now)
    .sort((left, right) => new Date(left.scheduled_at).getTime() - new Date(right.scheduled_at).getTime())[0];
  return nextRace ? mapCsvRace(nextRace) : null;
}

async function getChallengeFromCsv(raceId: string): Promise<PitWallChallenge | null> {
  const challenges = await readOptionalCsvFile<CsvChallengeRow>("predictions.racePickChallenges");
  const challenge = challenges.find((row) => row.race_id === raceId);
  return challenge ? mapCsvChallenge(challenge) : null;
}

async function getDriversFromCsv(raceId: string): Promise<PitWallDriver[]> {
  const [drivers, predictions] = await Promise.all([
    readOptionalCsvFile<CsvDriverRow>("curated.drivers"),
    readOptionalCsvFile<CsvPredictionRow>("curated.predictionSnapshots"),
  ]);
  const driverRowsById = new Map(drivers.map((driver) => [driver.id, driver]));
  const predictedIds = predictions
    .filter((row) => row.race_id === raceId)
    .sort((left, right) => (parseNumber(left.projected_finish) ?? 999) - (parseNumber(right.projected_finish) ?? 999))
    .map((row) => row.driver_id);
  const driverIds = predictedIds.length > 0 ? [...new Set(predictedIds)] : [...CURRENT_2026_DRIVER_IDS];

  return driverIds.map((driverId) => {
    const row = driverRowsById.get(driverId);
    if (row) {
      return {
        id: row.id,
        code: row.driver_code || null,
        name: row.full_name,
      };
    }
    const meta = getCurrentDriverMeta(driverId);
    return {
      id: meta.driverId,
      code: meta.driverCode,
      name: meta.displayName,
    };
  });
}

async function getPitWallPicksPayloadFromCsv(userId: string | null): Promise<PitWallPayload> {
  const race = await getActiveRaceFromCsv();
  if (!race) {
    return emptyPayload(Boolean(userId));
  }

  const challenge = await getChallengeFromCsv(race.id);
  if (!challenge) {
    return emptyPayload(Boolean(userId));
  }

  const drivers = await getDriversFromCsv(race.id);
  const isLocked = Date.now() >= new Date(challenge.qualifyingLockAt).getTime();

  return {
    configured: true,
    persistenceAvailable: false,
    runtimeMode: "csv-fallback",
    authenticated: Boolean(userId),
    race,
    challenge,
    isLocked,
    lockStatusLabel: isLocked ? "Locked" : "Open",
    drivers,
    userPick: null,
    userScore: null,
    raceLeaderboard: [],
    overallLeaderboard: [],
    raceHistory: [],
  };
}

export const getPitWallPicksPayload = cache(async (userId: string | null): Promise<PitWallPayload> => {
  const supabase = getSupabasePrivilegedClient();
  if (!supabase) {
    return getPitWallPicksPayloadFromCsv(userId);
  }

  try {
    const race = await getActiveRace(supabase);
    if (!race) {
      return emptyPayload(Boolean(userId));
    }

    const challenge = await getChallenge(supabase, race);
    if (!challenge) {
      return emptyPayload(Boolean(userId));
    }

    const [drivers, userPick, leaderboards, scoreData] = await Promise.all([
      getDrivers(supabase, race.id),
      getUserPick(supabase, race.id, userId),
      getLeaderboards(supabase, race.id),
      getUserScoreAndHistory(supabase, userId, race.id, challenge.randomPositions),
    ]);
    const isLocked = Date.now() >= new Date(challenge.qualifyingLockAt).getTime();

    return {
      configured: true,
      persistenceAvailable: true,
      runtimeMode: "database",
      authenticated: Boolean(userId),
      race,
      challenge,
      isLocked,
      lockStatusLabel: isLocked ? "Locked" : "Open",
      drivers,
      userPick,
      userScore: scoreData.userScore,
      raceLeaderboard: leaderboards.raceLeaderboard,
      overallLeaderboard: leaderboards.overallLeaderboard,
      raceHistory: scoreData.raceHistory,
    };
  } catch (error) {
    if (isMissingPitWallTableError(error)) {
      return getPitWallPicksPayloadFromCsv(userId);
    }
    throw error;
  }
});

export async function savePitWallPicksEntry(userId: string, input: PitWallPickPayloadInput) {
  const supabase = getSupabasePrivilegedClient();
  if (!supabase) {
    return { ok: false as const, status: 503, message: "Saving picks requires database setup." };
  }

  const duplicateError = validateNoDuplicateGroups(input);
  if (duplicateError) {
    return { ok: false as const, status: 400, message: duplicateError };
  }

  const [challengeResult, driversResult] = await Promise.all([
    supabase
      .from("race_pick_challenges")
      .select("race_id, qualifying_lock_at")
      .eq("race_id", input.raceId)
      .maybeSingle(),
    supabase.from("drivers").select("id"),
  ]);

  if (challengeResult.error || driversResult.error) {
    if (isMissingPitWallTableError(challengeResult.error ?? driversResult.error)) {
      return { ok: false as const, status: 503, message: "Saving picks requires database setup." };
    }
    throw new Error(`Failed to validate Picks entry: ${challengeResult.error?.message ?? driversResult.error?.message}`);
  }
  if (!challengeResult.data) {
    return { ok: false as const, status: 404, message: "This race is not available for Picks." };
  }
  if (Date.now() >= new Date(String(challengeResult.data.qualifying_lock_at)).getTime()) {
    return { ok: false as const, status: 409, message: "Picks are locked for this race." };
  }

  const validDriverIds = new Set(((driversResult.data ?? []) as Array<{ id: string }>).map((row) => row.id));
  const selectedDriverIds = [
    ...input.qualifyingTop3,
    ...input.raceTop3,
    ...input.randomDrivers,
    input.fastestPitStopDriverId,
    input.fastestLapDriverId,
  ];
  const invalidDriverIds = selectedDriverIds.filter((driverId) => !validDriverIds.has(driverId));
  if (invalidDriverIds.length > 0) {
    return { ok: false as const, status: 400, message: "One or more selected drivers are invalid.", details: { invalidDriverIds } };
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("user_race_picks")
    .upsert(
      {
        id: `${userId}_${input.raceId}`,
        user_id: userId,
        race_id: input.raceId,
        qualifying_p1_driver_id: input.qualifyingTop3[0],
        qualifying_p2_driver_id: input.qualifyingTop3[1],
        qualifying_p3_driver_id: input.qualifyingTop3[2],
        race_p1_driver_id: input.raceTop3[0],
        race_p2_driver_id: input.raceTop3[1],
        race_p3_driver_id: input.raceTop3[2],
        random_position_1_driver_id: input.randomDrivers[0],
        random_position_2_driver_id: input.randomDrivers[1],
        random_position_3_driver_id: input.randomDrivers[2],
        fastest_pit_stop_driver_id: input.fastestPitStopDriverId,
        fastest_lap_driver_id: input.fastestLapDriverId,
        submitted_at: now,
        updated_at: now,
      },
      { onConflict: "user_id,race_id" },
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to save Picks entry: ${error.message}`);
  }

  return { ok: true as const, pick: mapPick(data as PickRow) };
}
