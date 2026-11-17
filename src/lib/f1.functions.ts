import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  fetchChampionship,
  fetchHeadToHead,
  fetchMethodDashboard,
  fetchMethodDashboardLiveCounts,
  fetchPicksBoard,
  fetchLapTrace,
  fetchRaceReport,
  fetchRacePositionStory,
  localRacePositionStory,
  fetchRaceReports,
  fetchRaceWeek,
  fetchSeasonTelemetry,
  fetchWeekend,
  fetchWeekendIndex,
  SEASON,
} from "./f1.server";
import {
  fallbackChampionship,
  fallbackHeadToHead,
  fallbackPicksBoard,
  fallbackRaceReport,
  fallbackRaceReports,
  fallbackRaceWeek,
  fallbackSeasonTelemetry,
  fallbackWeekend,
  fallbackWeekendIndex,
} from "./f1.fallback";
import { shouldUseSupabaseProductData } from "./env.server";
import { TELEMETRY_SESSIONS } from "./telemetry-comparison";
import type { TelemetryComparison } from "./telemetry-comparison";

export type {
  ConstructorStanding,
  CornerComparison,
  DriverTelemetry,
  LapPoint,
  PositionLap,
  RacePositionStoryRow,
  RaceOption,
  RaceReportRow,
  RaceWeekDriver,
  RaceWeekQualifyingPrediction,
  RaceWeekStrategyRow,
  StintRow,
  SwingEvent,
  TrackPath,
  TrafficLap,
} from "./f1.server";

async function withFallback<T>(load: () => Promise<T>, fallback: () => T): Promise<T> {
  if (!shouldUseSupabaseProductData()) {
    return fallback();
  }
  try {
    return await load();
  } catch (error) {
    console.warn("Supabase read failed; using local fallback data.", error);
    return fallback();
  }
}

export const getSeasonTelemetry = createServerFn({ method: "GET" }).handler(() =>
  withFallback(fetchSeasonTelemetry, fallbackSeasonTelemetry),
);

export const getLapTrace = createServerFn({ method: "GET" })
  .validator((input) =>
    z
      .object({
        raceAnalysisId: z.string().min(1),
        drivers: z.array(z.string().min(1)).min(1).max(2),
      })
      .parse(input),
  )
  .handler(({ data }) =>
    withFallback(
      () => fetchLapTrace(data.raceAnalysisId, data.drivers),
      () => ({ raceAnalysisId: data.raceAnalysisId, laps: [] }),
    ),
  );

export const getRaceReports = createServerFn({ method: "GET" }).handler(() =>
  withFallback(fetchRaceReports, fallbackRaceReports),
);

export const getRaceReport = createServerFn({ method: "GET" })
  .validator((input) => z.object({ slug: z.string().min(1) }).parse(input))
  .handler(({ data }) =>
    withFallback(
      () => fetchRaceReport(data.slug),
      () => fallbackRaceReport(data.slug),
    ),
  );

export const getRaceWeek = createServerFn({ method: "GET" }).handler(() =>
  withFallback(fetchRaceWeek, fallbackRaceWeek),
);

export const getWeekendIndex = createServerFn({ method: "GET" })
  .validator((input) => z.object({ season: z.number().int().optional() }).parse(input ?? {}))
  .handler(({ data }) =>
    withFallback(
      () => fetchWeekendIndex(data.season ?? SEASON),
      () => fallbackWeekendIndex(data.season ?? SEASON),
    ),
  );

export const getWeekend = createServerFn({ method: "GET" })
  .validator((input) => z.object({ slug: z.string().min(1) }).parse(input))
  .handler(({ data }) =>
    withFallback(
      () => fetchWeekend(data.slug),
      () => fallbackWeekend(data.slug),
    ),
  );

export const getRacePositionStory = createServerFn({ method: "GET" })
  .validator((input) => z.object({ slug: z.string().min(1) }).parse(input))
  .handler(({ data }) =>
    withFallback(
      () => fetchRacePositionStory(data.slug),
      () => localRacePositionStory(data.slug),
    ),
  );

export const getChampionship = createServerFn({ method: "GET" })
  .validator((input) => z.object({ season: z.number().int().optional() }).parse(input ?? {}))
  .handler(({ data }) =>
    withFallback(
      () => fetchChampionship(data.season ?? SEASON),
      () => fallbackChampionship(data.season ?? SEASON),
    ),
  );

export const getHeadToHead = createServerFn({ method: "GET" })
  .validator((input) =>
    z.object({ slug: z.string().min(1), a: z.string().min(2), b: z.string().min(2) }).parse(input),
  )
  .handler(({ data }) =>
    withFallback(
      () => fetchHeadToHead(data.slug, data.a, data.b),
      () => fallbackHeadToHead(data.slug, data.a, data.b),
    ),
  );

export const getTelemetryComparison = createServerFn({ method: "GET" })
  .validator((input) =>
    z
      .object({
        slug: z.string().min(1),
        session: z.enum(TELEMETRY_SESSIONS),
        a: z.string().min(2),
        b: z.string().min(2),
      })
      .refine((value) => value.a.toUpperCase() !== value.b.toUpperCase(), {
        message: "Select two different drivers.",
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<TelemetryComparison> => {
    const weekend = await withFallback(
      () => fetchWeekend(data.slug),
      () => fallbackWeekend(data.slug),
    );
    if (!weekend) throw new Error("Weekend not found.");
    const { fetchTelemetryComparison } = await import("./telemetry-comparison.server");
    return fetchTelemetryComparison({
      season: weekend.season,
      round: weekend.round,
      event: weekend.name,
      resultsOnly: weekend.resultsOnly,
      session: data.session,
      a: data.a,
      b: data.b,
    });
  });

export type { TelemetryComparison } from "./telemetry-comparison";

export type {
  MethodDashboardData,
  MethodDashboardFile,
  MethodDashboardLiveCount,
  PickChallenge,
  PickEntrant,
  PickResults,
  TrafficSplit,
} from "./f1.server";

export const getPicksBoard = createServerFn({ method: "GET" })
  .validator((input) => z.object({ season: z.number().int().optional() }).parse(input ?? {}))
  .handler(({ data }) =>
    withFallback(
      () => fetchPicksBoard(data.season ?? SEASON),
      () => fallbackPicksBoard(data.season ?? SEASON),
    ),
  );

export const getMethodDashboard = createServerFn({ method: "GET" }).handler(() =>
  fetchMethodDashboard(),
);

export const getMethodDashboardLiveCounts = createServerFn({ method: "GET" })
  .validator((input) =>
    z
      .object({
        tables: z
          .array(z.object({ table: z.string().min(1), expectedRows: z.number().int().min(0) }))
          .max(50),
      })
      .parse(input),
  )
  .handler(({ data }) => fetchMethodDashboardLiveCounts(data.tables));
