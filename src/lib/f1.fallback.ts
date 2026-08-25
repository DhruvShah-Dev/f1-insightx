import {
  constructorStandings,
  driverStandings,
  nextRace,
  qualiProjection,
  raceReports as staticRaceReports,
  seasonState,
} from "@/data/season";
import { fallbackQualifyingPredictions } from "@/data/race-week-qualifying";
import { team } from "@/data/teams";

const DRIVER_ID_BY_CODE: Record<string, string> = {
  ALB: "albon",
  ALO: "alonso",
  ANT: "antonelli",
  BEA: "bearman",
  BOR: "bortoleto",
  BOT: "bottas",
  COL: "colapinto",
  GAS: "gasly",
  HAD: "hadjar",
  HAM: "hamilton",
  HUL: "hulkenberg",
  LAW: "lawson",
  LEC: "leclerc",
  LIN: "arvid_lindblad",
  NOR: "norris",
  OCO: "ocon",
  PER: "perez",
  PIA: "piastri",
  RUS: "russell",
  SAI: "sainz",
  STR: "stroll",
  TSU: "tsunoda",
  VER: "max_verstappen",
};

const codeToDriverId = (code: string) => DRIVER_ID_BY_CODE[code.toUpperCase()] ?? code.toLowerCase();

const driverName = (code: string) =>
  driverStandings.find((d) => d.code === code)?.name ?? code;

const constructorName = (key: string) => team(key).name;
const fallbackCircuitId = "monza";
const fallbackCircuitLocation = "Monza";
const fallbackRaceId = `2026-${String(nextRace.round).padStart(2, "0")}-${fallbackCircuitId}`;

export function fallbackSeasonTelemetry() {
  return {
    season: seasonState.season,
    standingsRound: seasonState.resultsThrough.round,
    constructorRound: seasonState.resultsThrough.round,
    drivers: driverStandings.map((d) => ({
      driverCode: d.code,
      driverName: d.name,
      team: constructorName(d.team),
      constructorName: constructorName(d.team),
      position: d.pos,
      points: d.points,
      wins: d.wins,
      standingsRound: seasonState.resultsThrough.round,
      qualiGapS: null,
      qualiSamples: null,
      racePaceDeltaS: null,
      consistencyS: null,
      degS: null,
      avgFieldRank: null,
      bestLapS: null,
      lapSamples: null,
    })),
    constructors: constructorStandings.map((c) => ({
      id: c.team,
      name: constructorName(c.team),
      position: c.pos,
      points: c.points,
      wins: c.wins,
    })),
    raceOptions: staticRaceReports.map((r) => ({
      id: r.slug,
      round: r.round,
      name: r.name,
      circuit: r.circuit,
    })),
  };
}

export function fallbackRaceWeek() {
  const sortedProjection = qualiProjection.slice().sort((a, b) => a.pos - b.pos);
  return {
    season: seasonState.season,
    round: nextRace.round,
    raceId: fallbackRaceId,
    raceName: nextRace.name,
    officialName: null,
    scheduledAt: nextRace.raceStartISO,
    sprintWeekend: false,
    circuit: {
      id: fallbackCircuitId,
      name: nextRace.circuit,
      location: fallbackCircuitLocation,
      country: nextRace.country,
      lengthKm: nextRace.lapKm,
      highSpeedBias: null,
      overtakeDifficulty: null,
      degBias: null,
    },
    trackPath: null,
    archetype: "track-position-dominant",
    strategyDifficulty: "medium",
    weather: {
      rainProb: nextRace.conditions.rainRiskPct / 100,
      trackTempC: nextRace.conditions.trackTempC,
      trackTempVolatility: null,
      windMps: Math.round((nextRace.conditions.windKph / 3.6) * 10) / 10,
      riskIndex: nextRace.conditions.rainRiskPct,
    },
    lastCompleted: {
      slug: staticRaceReports[0]?.slug ?? null,
      name: seasonState.resultsThrough.name,
      round: seasonState.resultsThrough.round,
    },
    drivers: sortedProjection.map((d) => ({
      driverId: codeToDriverId(d.code),
      code: d.code,
      name: d.name,
      team: constructorName(d.team),
      oneLapS: null,
      oneLapGapS: d.delta === "pole" || d.delta === "-" ? 0 : null,
      longRunS: null,
      longRunGapS: null,
      degS: null,
      readiness: d.conf,
      confidence: d.conf,
      projectedFinish: d.pos,
      summary: `${d.name} is ranked P${d.pos} in the committed local projection snapshot.`,
    })),
    constructors: constructorStandings.map((c) => ({
      id: c.team,
      name: constructorName(c.team),
      readiness: Math.max(0, Math.min(1, 1 - (c.pos - 1) / 10)),
      summary: `${constructorName(c.team)} is P${c.pos} in the committed constructor snapshot.`,
    })),
    strategy: sortedProjection.slice(0, 10).map((d) => ({
      driverId: codeToDriverId(d.code),
      code: d.code,
      name: d.name,
      team: constructorName(d.team),
      stops: 1,
      primary: "medium",
      secondary: "hard",
      windowStart: 24,
      windowEnd: 34,
      degRisk: "baseline",
      confidence: d.conf,
      rationale: "Local fallback uses the committed snapshot because Supabase is not configured.",
    })),
    projections: sortedProjection.map((d) => ({
      code: d.code,
      name: d.name,
      team: constructorName(d.team),
      projected: d.pos,
      low: d.pos,
      high: Math.min(20, d.pos + 3),
      winProb: d.pos === 1 ? 0.3 : Math.max(0.01, 0.12 - d.pos * 0.01),
      podiumProb: d.pos <= 3 ? 0.7 : Math.max(0.02, 0.4 - d.pos * 0.03),
      confidence: d.conf,
    })),
    qualifyingPredictions: fallbackQualifyingPredictions
      .slice()
      .sort((a, b) => a.rank - b.rank)
      .map((d) => ({
        driverId: d.driverId,
        code: d.code,
        name: d.name,
        team: d.constructorId,
        rank: d.rank,
        timeS: d.timeS,
        gapS: d.gapS,
        recentGapS: d.recentGapS,
        sameCircuitGapS: d.sameCircuitGapS,
        constructorGapS: d.constructorGapS,
        raceWeekDeltaGapS: d.raceWeekDeltaGapS,
        driverDeltaS: d.driverDeltaS,
        constructorDeltaS: d.constructorDeltaS,
        formBiasScore: d.formBiasScore,
        trackFitGapS: d.trackFitGapS,
        sourceUsefulnessScore: d.sourceUsefulnessScore,
        sourceUsefulnessRank: d.sourceUsefulnessRank,
        qualityNote: d.qualityNote,
        missingFlags: d.missingFlags,
        mode: d.mode,
        modeLabel: d.modeLabel,
        sourceLabel: d.sourceLabel,
      })),
    championship: driverStandings.slice(0, 6).map((d) => ({
      code: d.code,
      name: d.name,
      team: constructorName(d.team),
      position: d.pos,
      points: d.points,
      wins: d.wins,
    })),
    storylines: [
      {
        headline: "Local snapshot mode",
        body: "Supabase is not configured, so this view is using committed fallback data.",
        type: "data_source",
        confidence: "fallback",
        sourceTitle: null,
        sourceUrl: null,
      },
    ],
    previous: staticRaceReports.slice(0, 3).map((r) => ({
      slug: r.slug,
      season: 2026,
      round: r.round,
      winnerCode: r.winner.code,
      winnerTeam: constructorName(r.winner.team),
      date: r.dateISO,
    })),
  };
}

export function fallbackRaceReports() {
  return {
    reports: staticRaceReports.map((r) => ({
      slug: r.slug,
      round: r.round,
      name: r.name,
      circuit: r.circuit,
      dateISO: r.dateISO,
      winnerCode: r.winner.code,
      winnerName: r.winner.name,
      winnerTeam: constructorName(r.winner.team),
      podium: r.stints.map((s) => s.code).slice(0, 3),
      strategy: r.strategy,
      compoundPath: null,
      raceShape: "local snapshot",
      story: r.lede,
      weather: null,
      paceFactor: r.keyReads[0]?.note ?? null,
      strategyFactor: r.strategy,
      positionFactor: null,
      confidence: "fallback",
      weakestAssumption: "Committed static fallback; regenerate or connect Supabase for source-backed reports.",
    })),
  };
}

export function fallbackWeekendIndex(season = seasonState.season) {
  return {
    season,
    weekends: staticRaceReports.map((r) => ({
      raceId: r.slug,
      round: r.round,
      name: r.name,
      circuitId: r.circuit.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      circuit: r.circuit,
      scheduledAt: r.dateISO,
      sprintWeekend: false,
      slug: r.slug,
      resultsOnly: true,
      winnerCode: r.winner.code,
      winnerName: r.winner.name,
      winnerTeam: constructorName(r.winner.team),
      podium: r.stints.map((s) => s.code).slice(0, 3),
      strategy: r.strategy,
      raceShape: "local snapshot",
      story: r.lede,
      hasQuali: false,
      hasSprint: false,
      hasRace: true,
    })),
  };
}

export function fallbackRaceReport(slug: string) {
  const row = staticRaceReports.find((r) => r.slug === slug) ?? staticRaceReports[0];
  if (!row) return { report: null, stints: [], positions: [] };
  return {
    report: fallbackRaceReports().reports.find((r) => r.slug === row.slug) ?? null,
    stints: row.stints.map((s, index) => ({
      driver: s.code,
      team: constructorName(s.team),
      stint: index + 1,
      compound: s.plan.slice(0, 1),
      startLap: null,
      endLap: null,
      length: null,
      medianLapS: null,
      degS: null,
    })),
    positions: row.stints.map((s, index) => ({
      driver: s.code,
      team: constructorName(s.team),
      start: null,
      finish: index + 1,
      net: null,
    })),
  };
}

export function fallbackWeekend(slug: string) {
  const report = fallbackRaceReport(slug).report;
  if (!report) return null;
  return {
    slug: report.slug,
    resultsOnly: true,
    name: report.name,
    season: seasonState.season,
    round: report.round,
    dateISO: report.dateISO,
    circuit: report.circuit,
    sprintWeekend: false,
    quality: null,
    lapsAnalysed: 0,
    trackPath: null,
    winner: {
      code: report.winnerCode,
      name: report.winnerName,
      team: report.winnerTeam,
    },
    summary: {
      raceShape: report.raceShape,
      strategy: report.strategy,
      compoundPath: report.compoundPath,
      confidence: report.confidence,
      paceFactor: report.paceFactor,
      strategyFactor: report.strategyFactor,
      positionFactor: report.positionFactor,
    },
    qualifying: [],
    sprint: [],
    classification: report.podium.map((code, index) => ({
      code,
      name: driverName(code),
      team: report.winnerTeam,
      grid: null,
      finish: index + 1,
      status: "classified",
      laps: null,
      points: index === 0 ? 25 : index === 1 ? 18 : 15,
    })),
    positions: [],
    pace: [],
    stints: fallbackRaceReport(slug).stints.map((s) => ({
      code: s.driver,
      team: s.team,
      compound: s.compound,
      startLap: s.startLap,
      endLap: s.endLap,
    })),
    pits: [],
    stories: [
      {
        lap: null,
        phase: "result",
        title: "Local snapshot report",
        summary: report.story,
      },
    ],
    statusPhases: [],
    weather: [],
    laps: [],
  };
}

export function fallbackChampionship(season = seasonState.season) {
  const leader = driverStandings[0]?.points ?? 0;
  return {
    season,
    round: seasonState.resultsThrough.round,
    drivers: driverStandings.map((d) => ({
      code: d.code,
      name: d.name,
      driverId: codeToDriverId(d.code),
      team: constructorName(d.team),
      position: d.pos,
      points: d.points,
      gapToLeader: d.points - leader,
      wins: d.wins,
      podiums: 0,
      top10: 0,
      dnf: 0,
      starts: seasonState.resultsThrough.round,
      bestFinish: d.wins ? 1 : null,
      avgGrid: null,
      avgFinish: null,
      sprintPoints: 0,
    })),
    constructors: constructorStandings.map((c) => ({
      id: c.team,
      name: constructorName(c.team),
      position: c.pos,
      points: c.points,
      wins: c.wins,
    })),
    progression: [],
    constructorProgression: [],
    winnersByRound: staticRaceReports.map((r) => ({
      round: r.round,
      name: r.name,
      circuit: r.circuit,
      winnerCode: r.winner.code,
      winnerTeam: constructorName(r.winner.team),
    })),
  };
}

export function fallbackHeadToHead(slug: string, a: string, b: string) {
  const weekend = fallbackWeekend(slug);
  if (!weekend) return null;
  const entrants = driverStandings.map((d) => ({
    code: d.code,
    name: d.name,
    team: constructorName(d.team),
  }));
  const pick = (code: string) =>
    entrants.find((e) => e.code === code.toUpperCase()) ?? {
      code: code.toUpperCase(),
      name: code.toUpperCase(),
      team: "",
    };

  return {
    slug: weekend.slug,
    name: weekend.name,
    resultsOnly: true,
    round: weekend.round,
    season: weekend.season,
    circuit: weekend.circuit,
    sprintWeekend: false,
    trackPath: null,
    codes: [a.toUpperCase(), b.toUpperCase()] as [string, string],
    quali: [null, null],
    sprint: [null, null],
    race: [pick(a), pick(b)].map((d, index) => ({
      code: d.code,
      name: d.name,
      team: d.team,
      grid: null,
      finish: index + 1,
      status: "fallback",
      laps: null,
      points: null,
    })),
    positions: [null, null],
    pace: [null, null],
    stints: [[], []],
    pits: [[], []],
    laps: [[], []],
    traffic: [
      { code: a.toUpperCase(), cleanAirLaps: 0, trafficLaps: 0, uncertainLaps: 0, cleanAirPaceS: null, trafficPaceS: null, dirtyAirCostS: null, worstDirtyAirS: null },
      { code: b.toUpperCase(), cleanAirLaps: 0, trafficLaps: 0, uncertainLaps: 0, cleanAirPaceS: null, trafficPaceS: null, dirtyAirCostS: null, worstDirtyAirS: null },
    ],
    trafficLaps: [[], []],
    positionLaps: [[], []],
    swings: [],
    cornerComparisons: [],
    statusPhases: [],
    entrants,
  };
}

export function fallbackPicksBoard(season = seasonState.season) {
  return {
    season,
    entrants: driverStandings.map((d) => ({
      driverId: codeToDriverId(d.code),
      code: d.code,
      name: d.name,
      team: constructorName(d.team),
      standingPosition: d.pos,
      points: d.points,
      wins: d.wins,
      odds: Math.round((1 + d.pos * 0.7) * 10) / 10,
    })),
    standingsRound: seasonState.resultsThrough.round,
    challenges: [
      {
        raceId: fallbackRaceId,
        season,
        round: nextRace.round,
        raceName: nextRace.name,
        circuit: nextRace.circuit,
        circuitId: fallbackCircuitId,
        hasSprint: false,
        lockAtISO: nextRace.sessions.find((s) => s.code === "Q")?.startISO ?? null,
        scheduledAtISO: nextRace.raceStartISO,
        randomPositions: [7, 12],
        results: null,
      },
    ],
    activeRaceId: fallbackRaceId,
  };
}
