import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  fetchChampionship,
  fetchHeadToHead,
  fetchPicksBoard,
  fetchLapTrace,
  fetchRaceReport,
  fetchRaceReports,
  fetchRaceWeek,
  fetchSeasonTelemetry,
  fetchWeekend,
  fetchWeekendIndex,
  SEASON,
} from "./f1.server";

export type {
  ConstructorStanding,
  DriverTelemetry,
  LapPoint,
  PositionLap,
  RaceOption,
  RaceReportRow,
  RaceWeekDriver,
  RaceWeekStrategyRow,
  StintRow,
  SwingEvent,
  TrackPath,
  TrafficLap,
} from "./f1.server";

export const getSeasonTelemetry = createServerFn({ method: "GET" }).handler(() =>
  fetchSeasonTelemetry(),
);

export const getLapTrace = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z
      .object({ raceAnalysisId: z.string().min(1), drivers: z.array(z.string().min(1)).min(1).max(2) })
      .parse(input),
  )
  .handler(({ data }) => fetchLapTrace(data.raceAnalysisId, data.drivers));

export const getRaceReports = createServerFn({ method: "GET" }).handler(() => fetchRaceReports());

export const getRaceReport = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ slug: z.string().min(1) }).parse(input))
  .handler(({ data }) => fetchRaceReport(data.slug));

export const getRaceWeek = createServerFn({ method: "GET" }).handler(() => fetchRaceWeek());

export const getWeekendIndex = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ season: z.number().int().optional() }).parse(input ?? {}))
  .handler(({ data }) => fetchWeekendIndex(data.season ?? SEASON));

export const getWeekend = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ slug: z.string().min(1) }).parse(input))
  .handler(({ data }) => fetchWeekend(data.slug));

export const getChampionship = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ season: z.number().int().optional() }).parse(input ?? {}))
  .handler(({ data }) => fetchChampionship(data.season ?? SEASON));

export const getHeadToHead = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z
      .object({ slug: z.string().min(1), a: z.string().min(2), b: z.string().min(2) })
      .parse(input),
  )
  .handler(({ data }) => fetchHeadToHead(data.slug, data.a, data.b));

export type { PickChallenge, PickEntrant, PickResults, TrafficSplit } from "./f1.server";

export const getPicksBoard = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ season: z.number().int().optional() }).parse(input ?? {}))
  .handler(({ data }) => fetchPicksBoard(data.season ?? SEASON));
