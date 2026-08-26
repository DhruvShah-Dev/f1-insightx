import { createClient } from "@supabase/supabase-js";
import { readSupabaseRuntimeEnv } from "./env.server";
import { safeExternalHref } from "./security";

export const SEASON = 2026;

export function serverClient() {
  const { url, publishableKey: key } = readSupabaseRuntimeEnv();
  if (!url || !key) {
    throw new Error(
      "Missing Supabase environment variable(s): SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

type SB = ReturnType<typeof serverClient>;
type Row = Record<string, unknown>;

const num = (v: unknown) => (v == null || v === "" ? null : Number(v));
const str = (v: unknown) => (v == null ? null : String(v));

export function prettyCircuit(id: string) {
  return id
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export type DriverIdentity = { id: string; code: string; name: string };

export async function driverIndex(sb: SB) {
  const { data } = await sb
    .from("drivers")
    .select("id, driver_code, full_name")
    .not("driver_code", "is", null)
    .limit(2000);
  const byId = new Map<string, DriverIdentity>();
  const byCode = new Map<string, DriverIdentity>();
  for (const r of data ?? []) {
    const id = String(r["id"]);
    const code = String(r["driver_code"] ?? "").toUpperCase();
    const name = String(r["full_name"] ?? id);
    if (!/^[A-Z]{3}$/.test(code)) continue;
    const ident = { id, code, name };
    byId.set(id, ident);
    if (!byCode.has(code)) byCode.set(code, ident);
  }
  return { byId, byCode };
}

/* ------------------------------------------------------------------ */
/* Track geometry                                                      */
/* ------------------------------------------------------------------ */

export type TrackPath = {
  circuitId: string;
  pathData: string;
  rotation: number;
  source: string | null;
  sourceSeason: number | null;
};

export async function fetchTrackPath(sb: SB, circuitId: string): Promise<TrackPath | null> {
  const { data } = await sb
    .from("circuit_track_paths")
    .select("circuit_id, path_data, rotation_degrees, source, season")
    .eq("circuit_id", circuitId)
    .order("season", { ascending: false })
    .limit(1);
  const r = data?.[0];
  if (!r) return null;
  return {
    circuitId: String(r["circuit_id"]),
    pathData: String(r["path_data"] ?? ""),
    rotation: Number(r["rotation_degrees"] ?? 0),
    source: str(r["source"]),
    sourceSeason: num(r["season"]),
  };
}

/* ------------------------------------------------------------------ */
/* Race week                                                           */
/* ------------------------------------------------------------------ */

export type RaceWeekDriver = {
  driverId: string;
  code: string;
  name: string;
  team: string;
  oneLapS: number | null;
  oneLapGapS: number | null;
  longRunS: number | null;
  longRunGapS: number | null;
  degS: number | null;
  readiness: number | null;
  confidence: number | null;
  projectedFinish: number | null;
  summary: string | null;
};

export type RaceWeekStrategyRow = {
  driverId: string;
  code: string;
  name: string;
  team: string;
  stops: number | null;
  primary: string | null;
  secondary: string | null;
  windowStart: number | null;
  windowEnd: number | null;
  degRisk: string | null;
  confidence: number | null;
  rationale: string | null;
};

export type RaceWeekQualifyingPrediction = {
  driverId: string;
  code: string;
  name: string;
  team: string;
  rank: number | null;
  timeS: number | null;
  gapS: number | null;
  recentGapS: number | null;
  sameCircuitGapS: number | null;
  constructorGapS: number | null;
  raceWeekDeltaGapS: number | null;
  driverDeltaS: number | null;
  constructorDeltaS: number | null;
  formBiasScore: number | null;
  trackFitGapS: number | null;
  sourceUsefulnessScore: number | null;
  sourceUsefulnessRank: number | null;
  qualityNote: string | null;
  missingFlags: string | null;
  mode: string | null;
  modeLabel: string | null;
  sourceLabel: string | null;
};

export async function fetchRaceWeek() {
  const sb = serverClient();
  const nowISO = new Date().toISOString();

  const [{ data: raceRows }, { data: circuitRows }, idx] = await Promise.all([
    sb
      .from("races")
      .select("id, season, round, race_name, official_name, circuit_id, scheduled_at, sprint_weekend")
      .eq("season", SEASON)
      .order("round", { ascending: true }),
    sb.from("circuits").select("id, name, location, country, track_length_km, high_speed_bias, overtake_difficulty, tire_degradation_bias").limit(200),
    driverIndex(sb),
  ]);

  const races = raceRows ?? [];
  const upcoming = races.filter((r) => String(r["scheduled_at"] ?? "") > nowISO);
  const race = (upcoming[0] ?? races[races.length - 1]) as Row | undefined;
  if (!race) return null;

  const round = Number(race["round"]);
  const raceId = String(race["id"]);
  const circuitId = String(race["circuit_id"]);

  const [board, cons, strat, stories, weather, overview, projection, quali, ctx, path, history, standings] =
    await Promise.all([
      sb.from("race_week_driver_board").select("*").eq("season", SEASON).eq("round", round),
      sb.from("race_week_constructor_board").select("*").eq("season", SEASON).eq("round", round),
      sb.from("race_week_strategy").select("*").eq("season", SEASON).eq("round", round),
      sb
        .from("race_week_storylines")
        .select("*")
        .eq("season", SEASON)
        .eq("round", round)
        .order("priority_rank", { ascending: true }),
      sb.from("weather_risk_summary").select("*").eq("season", SEASON).eq("round", round).maybeSingle(),
      sb.from("race_week_overview").select("*").eq("season", SEASON).eq("round", round).maybeSingle(),
      sb.from("race_projection").select("*").eq("season", SEASON).eq("round", round),
      sb
        .from("spain_qualifying_prediction")
        .select("*")
        .eq("season", SEASON)
        .eq("round", round)
        .eq("prediction_mode", "baseline")
        .order("predicted_q_rank", { ascending: true }),
      sb.from("race_week_context").select("*").eq("season", SEASON).eq("round", round).maybeSingle(),
      fetchTrackPath(sb, circuitId),
      sb
        .from("race_analysis_index")
        .select("race_analysis_id, season, round, race_name, circuit, winner, winner_team, race_date")
        .eq("circuit", circuitId)
        .limit(20),
      sb
        .from("driver_standings")
        .select("driver_id, constructor_id, standing_position, points, wins, round")
        .eq("season", SEASON)
        .order("round", { ascending: false })
        .limit(200),
    ]);

  const { byId } = idx;
  const ident = (id: string) => byId.get(id) ?? { id, code: id.slice(0, 3).toUpperCase(), name: id };

  const bestOf = (rows: Row[], key: string) => {
    const vals = (rows ?? []).map((r) => num(r[key])).filter((v): v is number => v != null);
    return vals.length ? Math.min(...vals) : null;
  };
  const boardRows = (board.data ?? []) as Row[];
  const bestOneLap = bestOf(boardRows, "one_lap_pace_s");
  const bestLongRun = bestOf(boardRows, "long_run_pace_s");

  const drivers: RaceWeekDriver[] = boardRows
    .map((r) => {
      const who = ident(String(r["driver_id"]));
      const one = num(r["one_lap_pace_s"]);
      const long = num(r["long_run_pace_s"]);
      return {
        driverId: who.id,
        code: who.code,
        name: who.name,
        team: String(r["constructor_name"] ?? r["constructor_id"] ?? ""),
        oneLapS: one,
        oneLapGapS: one != null && bestOneLap != null ? one - bestOneLap : null,
        longRunS: long,
        longRunGapS: long != null && bestLongRun != null ? long - bestLongRun : null,
        degS: num(r["degradation_s_per_lap"]),
        readiness: num(r["readiness_score"]),
        confidence: num(r["signal_confidence"]),
        projectedFinish: num(r["projected_finish"]),
        summary: str(r["summary"]),
      };
    })
    .sort((a, b) => (a.projectedFinish ?? 99) - (b.projectedFinish ?? 99));

  const strategy: RaceWeekStrategyRow[] = ((strat.data ?? []) as Row[]).map((r) => {
    const who = ident(String(r["driver_id"]));
    return {
      driverId: who.id,
      code: who.code,
      name: who.name,
      team: String(r["constructor_id"] ?? ""),
      stops: num(r["recommended_stop_count"]),
      primary: str(r["preferred_primary_compound"]),
      secondary: str(r["preferred_secondary_compound"]),
      windowStart: num(r["pit_window_start_lap"]),
      windowEnd: num(r["pit_window_end_lap"]),
      degRisk: str(r["degradation_risk"]),
      confidence: num(r["strategy_confidence"]),
      rationale: str(r["rationale"]),
    };
  });

  const projections = ((projection.data ?? []) as Row[])
    .map((r) => {
      const who = ident(String(r["driver_id"]));
      return {
        code: who.code,
        name: who.name,
        team: String(r["constructor_id"] ?? ""),
        projected: num(r["projected_finish"]),
        low: num(r["finish_band_low"]),
        high: num(r["finish_band_high"]),
        winProb: num(r["win_probability"]),
        podiumProb: num(r["podium_probability"]),
        confidence: num(r["confidence_score"]),
      };
    })
    .sort((a, b) => (a.projected ?? 99) - (b.projected ?? 99));

  const qualifyingPredictions: RaceWeekQualifyingPrediction[] = ((quali.data ?? []) as Row[])
    .filter((r) => str(r["mode_status"]) !== "unavailable")
    .map((r) => {
      const who = ident(String(r["driver_id"]));
      return {
        driverId: who.id,
        code: who.code,
        name: who.name,
        team: String(r["constructor_id"] ?? ""),
        rank: num(r["predicted_q_rank"]),
        timeS: num(r["predicted_q_time_s"]),
        gapS: num(r["predicted_q_gap_s"]),
        recentGapS: num(r["recent_quali_gap_s"]),
        sameCircuitGapS: num(r["same_circuit_gap_s"]),
        constructorGapS: num(r["constructor_quali_gap_s"]),
        raceWeekDeltaGapS: num(r["race_week_delta_gap_s"]),
        driverDeltaS: num(r["driver_gap_delta_s"]),
        constructorDeltaS: num(r["constructor_gap_delta_s"]),
        formBiasScore: num(r["form_bias_score"]),
        trackFitGapS: num(r["track_fit_gap_s"]),
        sourceUsefulnessScore: num(r["source_usefulness_score"]),
        sourceUsefulnessRank: num(r["source_usefulness_rank"]),
        qualityNote: str(r["quality_note"]),
        missingFlags: str(r["missing_flags"]),
        mode: str(r["prediction_mode"]),
        modeLabel: str(r["mode_label"]),
        sourceLabel: str(r["source_label"]),
      };
    })
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));

  const latestRound = Math.max(
    0,
    ...((standings.data ?? []) as Row[]).map((r) => Number(r["round"] ?? 0)),
  );
  const championship = ((standings.data ?? []) as Row[])
    .filter((r) => Number(r["round"] ?? 0) === latestRound)
    .map((r) => {
      const who = ident(String(r["driver_id"]));
      return {
        code: who.code,
        name: who.name,
        team: String(r["constructor_id"] ?? ""),
        position: Number(r["standing_position"] ?? 0),
        points: Number(r["points"] ?? 0),
        wins: Number(r["wins"] ?? 0),
      };
    })
    .sort((a, b) => a.position - b.position)
    .slice(0, 6);

  const circuit = ((circuitRows ?? []) as Row[]).find((c) => String(c["id"]) === circuitId);

  const previous = ((history.data ?? []) as Row[])
    .map((r) => ({
      slug: String(r["race_analysis_id"]),
      season: Number(r["season"]),
      round: Number(r["round"]),
      winnerCode: String(r["winner"] ?? ""),
      winnerTeam: String(r["winner_team"] ?? ""),
      date: String(r["race_date"] ?? ""),
    }))
    .sort((a, b) => b.season - a.season)
    .slice(0, 3);

  const w = (weather.data ?? undefined) as Row | undefined;
  const o = (overview.data ?? undefined) as Row | undefined;
  const c = (ctx.data ?? undefined) as Row | undefined;

  return {
    season: SEASON,
    round,
    raceId,
    raceName: String(race["race_name"] ?? ""),
    officialName: str(race["official_name"]),
    scheduledAt: String(race["scheduled_at"] ?? ""),
    sprintWeekend: Boolean(race["sprint_weekend"]),
    circuit: {
      id: circuitId,
      name: circuit ? String(circuit["name"]) : prettyCircuit(circuitId),
      location: circuit ? str(circuit["location"]) : null,
      country: circuit ? str(circuit["country"]) : null,
      lengthKm: circuit ? num(circuit["track_length_km"]) : null,
      highSpeedBias: circuit ? num(circuit["high_speed_bias"]) : null,
      overtakeDifficulty: circuit ? num(circuit["overtake_difficulty"]) : null,
      degBias: circuit ? num(circuit["tire_degradation_bias"]) : null,
    },
    trackPath: path,
    archetype: o ? str(o["archetype_label"]) : null,
    strategyDifficulty: o ? str(o["strategy_difficulty"]) : null,
    weather: w
      ? {
          rainProb: num(w["rainfall_probability"]),
          trackTempC: num(w["track_temp_mean_c"]),
          trackTempVolatility: num(w["track_temp_volatility_c"]),
          windMps: num(w["wind_speed_mean_mps"]),
          riskIndex: num(w["weather_risk_index"]),
        }
      : null,
    lastCompleted: c
      ? {
          slug: str(c["latest_completed_race_id"]),
          name: str(c["latest_completed_race_name"]),
          round: num(c["latest_completed_round"]),
        }
      : null,
    drivers,
    constructors: ((cons.data ?? []) as Row[]).map((r) => ({
      id: String(r["constructor_id"]),
      name: String(r["constructor_name"] ?? r["constructor_id"]),
      readiness: num(r["readiness_score"]),
      summary: str(r["summary"]),
    })),
    strategy,
    projections,
    qualifyingPredictions,
    championship,
    storylines: ((stories.data ?? []) as Row[]).map((r) => ({
      headline: String(r["headline"] ?? ""),
      body: str(r["body"]),
      type: str(r["storyline_type"]),
      confidence: str(r["confidence_band"]),
      sourceTitle: str(r["source_title"]),
      sourceUrl: safeExternalHref(str(r["source_url"])),
    })),
    previous,
  };
}

/* ------------------------------------------------------------------ */
/* Weekend index (analysis list)                                       */
/* ------------------------------------------------------------------ */

export async function fetchWeekendIndex(season: number) {
  const sb = serverClient();
  const [{ data: races }, { data: idx }, { data: sums }, { data: sprints }, { data: quali }, { data: podiums }] =
    await Promise.all([
      sb
        .from("races")
        .select("id, season, round, race_name, circuit_id, scheduled_at, sprint_weekend")
        .eq("season", season)
        .order("round", { ascending: true }),
      sb
        .from("race_analysis_index")
        .select("race_analysis_id, season, round, race_name, circuit, race_date, winner, winner_team, analysis_quality_score")
        .eq("season", String(season)),
      sb.from("race_analysis_summary").select("race_analysis_id, podium, dominant_strategy, race_shape, primary_story"),
      sb.from("sprint_results").select("race_id").limit(1000),
      sb.from("qualifying_results").select("race_id").limit(1000),
      sb
        .from("race_results")
        .select("race_id, driver_id, constructor_id, finish_position")
        .like("race_id", `${season}-%`)
        .lte("finish_position", 3)
        .order("finish_position", { ascending: true })
        .limit(1000),
    ]);

  const { byId, byCode } = await driverIndex(sb);
  const byRound = new Map<number, Row>();
  for (const r of (idx ?? []) as Row[]) byRound.set(Number(r["round"]), r);
  const summaries = new Map<string, Row>();
  for (const s of (sums ?? []) as Row[]) summaries.set(String(s["race_analysis_id"]), s);
  const sprintRaces = new Set((sprints ?? []).map((r) => String(r["race_id"])));
  const qualiRaces = new Set((quali ?? []).map((r) => String(r["race_id"])));
  // Results-based podium per race, used for rounds whose telemetry report isn't stored yet.
  const podiumByRace = new Map<string, { code: string; name: string; team: string }[]>();
  for (const r of (podiums ?? []) as Row[]) {
    const raceId = String(r["race_id"]);
    const who = byId.get(String(r["driver_id"]));
    const list = podiumByRace.get(raceId) ?? [];
    list.push({
      code: who?.code ?? String(r["driver_id"]).slice(0, 3).toUpperCase(),
      name: who?.name ?? String(r["driver_id"]),
      team: String(r["constructor_id"] ?? ""),
    });
    podiumByRace.set(raceId, list);
  }
  const ident = (code: string) => byCode.get(code.toUpperCase()) ?? byId.get(code);

  return {
    season,
    weekends: ((races ?? []) as Row[]).map((r) => {
      const round = Number(r["round"]);
      const raceId = String(r["id"]);
      const a = byRound.get(round);
      const podiumRows = podiumByRace.get(raceId) ?? [];
      const resultsOnly = !a && podiumRows.length > 0;
      const slug = a ? String(a["race_analysis_id"]) : resultsOnly ? raceId : null;
      const s = a && slug ? summaries.get(slug) : undefined;
      const winner = a ? String(a["winner"] ?? "") : (podiumRows[0]?.code ?? "");
      return {
        raceId,
        round,
        name: String(r["race_name"] ?? ""),
        circuitId: String(r["circuit_id"] ?? ""),
        circuit: prettyCircuit(String(r["circuit_id"] ?? "")),
        scheduledAt: String(r["scheduled_at"] ?? ""),
        sprintWeekend: Boolean(r["sprint_weekend"]),
        slug,
        resultsOnly,
        winnerCode: winner || null,
        winnerName: winner ? (ident(winner)?.name ?? winner) : null,
        winnerTeam: a ? str(a["winner_team"]) : (podiumRows[0]?.team ?? null),
        podium: s
          ? String(s["podium"] ?? "").split(",").map((x) => x.trim()).filter(Boolean)
          : podiumRows.map((p) => p.code),
        strategy: s ? str(s["dominant_strategy"]) : null,
        raceShape: s ? str(s["race_shape"]) : null,
        story: s ? str(s["primary_story"]) : null,
        hasQuali: qualiRaces.has(raceId),
        hasSprint: sprintRaces.has(raceId),
        hasRace: Boolean(slug),
      };
    }),
  };

}

/* ------------------------------------------------------------------ */
/* Weekend detail                                                      */
/* ------------------------------------------------------------------ */


/** race_analysis_pace_evolution can exceed the 1000-row API cap, so page through it. */
async function fetchAllPaceRows(sb: SB, slug: string) {
  const out: Row[] = [];
  for (let page = 0; page < 4; page++) {
    const { data } = await sb
      .from("race_analysis_pace_evolution")
      .select(
        "driver, team, lap_number, lap_time_s, normalized_pace_delta_s, fuel_corrected_delta_s, compound, stint_number, tyre_age, field_rank_on_lap",
      )
      .eq("race_analysis_id", slug)
      .order("lap_number", { ascending: true })
      .range(page * 1000, page * 1000 + 999);
    const rows = (data ?? []) as Row[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

export async function fetchWeekend(slug: string) {
  const sb = serverClient();
  const { data: indexHead } = await sb
    .from("race_analysis_index")
    .select("*")
    .eq("race_analysis_id", slug)
    .maybeSingle();

  // Rounds whose telemetry analysis hasn't been ingested yet still carry full
  // race/qualifying classifications, so fall back to the races row and render a
  // results-only report instead of 404ing.
  let head = indexHead as Row | null;
  let resultsOnly = false;
  let winnerDriverId: string | null = null;
  if (!head) {
    const [{ data: raceOnly }, { data: win }] = await Promise.all([
      sb
        .from("races")
        .select("id, season, round, race_name, circuit_id, scheduled_at")
        .eq("id", slug)
        .maybeSingle(),
      sb
        .from("race_results")
        .select("driver_id, constructor_id")
        .eq("race_id", slug)
        .eq("finish_position", 1)
        .maybeSingle(),
    ]);
    if (!raceOnly || !win) return null;
    resultsOnly = true;
    winnerDriverId = String(win["driver_id"] ?? "");
    head = {
      season: raceOnly["season"],
      round: raceOnly["round"],
      circuit: raceOnly["circuit_id"],
      race_name: raceOnly["race_name"],
      race_date: raceOnly["scheduled_at"],
      winner: "",
      winner_team: win["constructor_id"],
      analysis_quality_score: null,
    } as Row;
  }

  const season = Number(head["season"]);
  const round = Number(head["round"]);
  const raceId = `${season}-${String(round).padStart(2, "0")}-${String(head["circuit"])}`;
  const circuitId = String(head["circuit"]);


  const [
    idx,
    { data: raceRow },
    { data: qualiRows },
    { data: sprintRows },
    { data: resultRows },
    { data: summary },
    { data: stintRows },
    { data: pitRows },
    { data: storyRows },
    { data: posRows },
    { data: weatherRows },
    { data: statusRows },
    paceRows,
    path,
  ] = await Promise.all([
    driverIndex(sb),
    sb.from("races").select("*").eq("id", raceId).maybeSingle(),
    sb
      .from("qualifying_results")
      .select("driver_id, constructor_id, position, q1_time_ms, q2_time_ms, q3_time_ms, status")
      .eq("race_id", raceId)
      .order("position", { ascending: true }),
    sb
      .from("sprint_results")
      .select("driver_id, constructor_id, grid_position, finish_position, points, laps_completed, finish_status")
      .eq("race_id", raceId)
      .order("finish_position", { ascending: true }),
    sb
      .from("race_results")
      .select("driver_id, constructor_id, grid_position, finish_position, points, laps_completed, finish_status, fastest_lap_rank")
      .eq("race_id", raceId)
      .order("finish_position", { ascending: true }),
    sb.from("race_analysis_summary").select("*").eq("race_analysis_id", slug).maybeSingle(),
    sb.from("race_analysis_stints").select("*").eq("race_analysis_id", slug).limit(500),
    sb.from("race_analysis_pit_strategy").select("*").eq("race_analysis_id", slug).limit(400),
    sb
      .from("race_analysis_story_points")
      .select("*")
      .eq("race_analysis_id", slug)
      .order("lap_number", { ascending: true })
      .limit(50),
    sb.from("race_analysis_position_changes").select("*").eq("race_analysis_id", slug).limit(40),
    sb
      .from("race_analysis_weather_context")
      .select("lap_number, air_temp_c, track_temp_c, humidity_pct, rainfall, weather_state, weather_impact_label")
      .eq("race_analysis_id", slug)
      .order("lap_number", { ascending: true })
      .limit(120),
    sb
      .from("race_analysis_track_status")
      .select("lap_number, phase, track_status_label")
      .eq("race_analysis_id", slug)
      .order("lap_number", { ascending: true })
      .limit(120),
    fetchAllPaceRows(sb, slug),
    fetchTrackPath(sb, circuitId),
  ]);

  const { byId, byCode } = idx;
  const ident = (id: string) => byId.get(id) ?? { id, code: id.slice(0, 3).toUpperCase(), name: id };
  const fromCode = (code: string) =>
    byCode.get(code.toUpperCase()) ?? { id: code, code: code.toUpperCase(), name: code };

  const bestQ = (rows: Row[]) => {
    const v = rows
      .map((r) => num(r["q3_time_ms"]) ?? num(r["q2_time_ms"]) ?? num(r["q1_time_ms"]))
      .filter((x): x is number => x != null);
    return v.length ? Math.min(...v) : null;
  };
  const qRows = (qualiRows ?? []) as Row[];
  const pole = bestQ(qRows);

  const qualifying = qRows.map((r) => {
    const who = ident(String(r["driver_id"]));
    const best = num(r["q3_time_ms"]) ?? num(r["q2_time_ms"]) ?? num(r["q1_time_ms"]);
    return {
      position: Number(r["position"] ?? 0),
      code: who.code,
      name: who.name,
      team: String(r["constructor_id"] ?? ""),
      q1Ms: num(r["q1_time_ms"]),
      q2Ms: num(r["q2_time_ms"]),
      q3Ms: num(r["q3_time_ms"]),
      bestMs: best,
      gapMs: best != null && pole != null ? best - pole : null,
      segment: r["q3_time_ms"] != null ? "Q3" : r["q2_time_ms"] != null ? "Q2" : "Q1",
      status: str(r["status"]),
    };
  });

  const sprint = ((sprintRows ?? []) as Row[]).map((r) => {
    const who = ident(String(r["driver_id"]));
    return {
      code: who.code,
      name: who.name,
      team: String(r["constructor_id"] ?? ""),
      grid: num(r["grid_position"]),
      finish: num(r["finish_position"]),
      points: num(r["points"]),
      laps: num(r["laps_completed"]),
      status: str(r["finish_status"]),
    };
  });

  const classification = ((resultRows ?? []) as Row[]).map((r) => {
    const who = ident(String(r["driver_id"]));
    return {
      code: who.code,
      name: who.name,
      team: String(r["constructor_id"] ?? ""),
      grid: num(r["grid_position"]),
      finish: num(r["finish_position"]),
      points: num(r["points"]),
      laps: num(r["laps_completed"]),
      status: str(r["finish_status"]),
      fastestLapRank: num(r["fastest_lap_rank"]),
    };
  });

  const stints = ((stintRows ?? []) as Row[])
    .map((r) => {
      const who = fromCode(String(r["driver"] ?? ""));
      return {
        code: who.code,
        name: who.name,
        team: String(r["team"] ?? ""),
        stint: Number(r["stint_number"] ?? 0),
        compound: str(r["compound"]),
        startLap: num(r["start_lap"]),
        endLap: num(r["end_lap"]),
        length: num(r["stint_length"]),
        medianS: num(r["median_lap_time_s"]),
        bestS: num(r["best_lap_time_s"]),
        degS: num(r["degradation_s_per_lap"]),
        quality: num(r["stint_quality_score"]),
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code) || a.stint - b.stint);

  const pits = ((pitRows ?? []) as Row[])
    .map((r) => {
      const who = fromCode(String(r["driver"] ?? ""));
      return {
        code: who.code,
        team: String(r["team"] ?? ""),
        stop: Number(r["pit_stop_number"] ?? 0),
        lap: num(r["pit_lap"]),
        from: str(r["compound_from"]),
        to: str(r["compound_to"]),
        posBefore: num(r["position_before_pit"]),
        posAfter: num(r["position_after_cycle"]),
        net: num(r["net_position_change"]),
        lossS: num(r["estimated_pit_loss_s"]),
        trafficPenaltyS: num(r["traffic_penalty_proxy_s"]),
        rejoinRisk: str(r["rejoin_risk"]),
        stintBefore: num(r["stint_length_before"]),
        label: str(r["undercut_overcut_label"]),
        effect: str(r["strategy_effect"]),
      };
    })
    .sort((a, b) => (a.lap ?? 0) - (b.lap ?? 0));

  const positions = ((posRows ?? []) as Row[])
    .map((r) => {
      const who = fromCode(String(r["driver"] ?? ""));
      return {
        code: who.code,
        name: who.name,
        team: String(r["team"] ?? ""),
        start: num(r["start_position"]),
        finish: num(r["finish_position"]),
        net: num(r["net_position_change"]),
        onTrack: num(r["positions_gained_on_track_proxy"]),
        inPits: num(r["positions_gained_in_pit_cycles_proxy"]),
        volatility: num(r["position_volatility_score"]),
        note: str(r["note"]),
      };
    })
    .sort((a, b) => (a.finish ?? 99) - (b.finish ?? 99));

  const stories = ((storyRows ?? []) as Row[]).map((r) => ({
    lap: num(r["lap_number"]),
    phase: str(r["phase"]),
    title: String(r["title"] ?? ""),
    summary: str(r["summary"]),
    drivers: str(r["drivers_involved"]),
    metric: str(r["related_metric"]),
    impact: num(r["impact_score"]),
    confidence: str(r["confidence"]),
  }));

  const weather = ((weatherRows ?? []) as Row[]).map((r) => ({
    lap: Number(r["lap_number"] ?? 0),
    airC: num(r["air_temp_c"]),
    trackC: num(r["track_temp_c"]),
    humidity: num(r["humidity_pct"]),
    rain: Boolean(r["rainfall"]),
    state: str(r["weather_state"]),
    impact: str(r["weather_impact_label"]),
  }));

  const statusPhases: { label: string; fromLap: number; toLap: number }[] = [];
  for (const r of (statusRows ?? []) as Row[]) {
    const label = String(r["track_status_label"] ?? "");
    const lap = Number(r["lap_number"] ?? 0);
    const prev = statusPhases[statusPhases.length - 1];
    if (prev && prev.label === label && lap === prev.toLap + 1) prev.toLap = lap;
    else statusPhases.push({ label, fromLap: lap, toLap: lap });
  }

  // Per-driver race pace roll-up from the lap-level table.
  const paceByDriver = new Map<string, { deltas: number[]; laps: number; best: number | null }>();
  type LapRow = {
    code: string;
    lap: number;
    lapTimeS: number | null;
    paceDeltaS: number | null;
    fuelCorrectedDeltaS: number | null;
    compound: string | null;
    stint: number | null;
    tyreAge: number | null;
    rank: number | null;
  };
  // The pipeline can emit duplicate / out-of-order lap rows for a driver, which
  // made the lap traces double back on themselves. Key on driver+lap, keep the
  // most complete row, then sort by lap.
  const lapKeyed = new Map<string, LapRow>();
  for (const r of paceRows) {
    const code = String(r["driver"] ?? "").toUpperCase();
    const lap = Number(r["lap_number"] ?? 0);
    if (!code || !Number.isFinite(lap) || lap <= 0) continue;
    const lapTime = num(r["lap_time_s"]);
    const fuel = num(r["fuel_corrected_delta_s"]);
    const row: LapRow = {
      code,
      lap,
      lapTimeS: lapTime,
      paceDeltaS: num(r["normalized_pace_delta_s"]),
      fuelCorrectedDeltaS: fuel,
      compound: str(r["compound"]),
      stint: num(r["stint_number"]),
      tyreAge: num(r["tyre_age"]),
      rank: num(r["field_rank_on_lap"]),
    };
    const key = `${code}|${lap}`;
    const prev = lapKeyed.get(key);
    if (prev) {
      // prefer the row that actually carries a lap time
      if (prev.lapTimeS != null && row.lapTimeS == null) continue;
      if (prev.lapTimeS != null && row.lapTimeS != null) continue;
    }
    lapKeyed.set(key, row);
  }
  const laps: LapRow[] = [...lapKeyed.values()].sort(
    (x, y) => x.code.localeCompare(y.code) || x.lap - y.lap,
  );
  for (const l of laps) {
    const entry = paceByDriver.get(l.code) ?? { deltas: [], laps: 0, best: null };
    entry.laps += 1;
    if (l.fuelCorrectedDeltaS != null) entry.deltas.push(l.fuelCorrectedDeltaS);
    if (l.lapTimeS != null)
      entry.best = entry.best == null ? l.lapTimeS : Math.min(entry.best, l.lapTimeS);
    paceByDriver.set(l.code, entry);
  }

  const median = (xs: number[]) => {
    if (!xs.length) return null;
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)]!;
  };
  const pace = [...paceByDriver.entries()]
    .map(([code, v]) => {
      const who = fromCode(code);
      return {
        code,
        name: who.name,
        medianFuelDeltaS: median(v.deltas),
        bestLapS: v.best,
        lapCount: v.laps,
      };
    })
    .sort((a, b) => (a.medianFuelDeltaS ?? 99) - (b.medianFuelDeltaS ?? 99));

  const s = (summary ?? undefined) as Row | undefined;
  const winnerCode = winnerDriverId ? ident(winnerDriverId).code : String(head["winner"] ?? "");

  return {
    slug,
    resultsOnly,

    season,
    round,
    raceId,
    name: String(head["race_name"] ?? ""),
    circuitId,
    circuit: prettyCircuit(circuitId),
    dateISO: String(head["race_date"] ?? ""),
    sprintWeekend: raceRow ? Boolean(raceRow["sprint_weekend"]) : sprint.length > 0,
    scheduledAt: raceRow ? String(raceRow["scheduled_at"] ?? "") : null,
    lapsAnalysed: laps.length,
    trackPath: path,
    winner: { code: winnerCode, name: fromCode(winnerCode).name, team: String(head["winner_team"] ?? "") },
    quality: num(head["analysis_quality_score"]),
    summary: s
      ? {
          podium: String(s["podium"] ?? "").split(",").map((x) => x.trim()).filter(Boolean),
          strategy: str(s["dominant_strategy"]),
          compoundPath: str(s["winning_compound_path"]),
          raceShape: str(s["race_shape"]),
          story: str(s["primary_story"]),
          paceFactor: str(s["key_pace_factor"]),
          strategyFactor: str(s["key_strategy_factor"]),
          positionFactor: str(s["key_position_factor"]),
          weather: str(s["weather_summary"]),
          confidence: str(s["confidence"]),
          weakestAssumption: str(s["weakest_assumption"]),
        }
      : null,
    qualifying,
    sprint,
    classification,
    stints,
    pits,
    positions,
    stories,
    weather,
    statusPhases,
    pace,
    laps,
  };
}

/* ------------------------------------------------------------------ */
/* Championship                                                        */
/* ------------------------------------------------------------------ */

export async function fetchChampionship(season: number) {
  const sb = serverClient();
  const [idx, { data: ds }, { data: cs }, { data: rr }, { data: sr }, { data: cons }, { data: races }] =
    await Promise.all([
      driverIndex(sb),
      sb
        .from("driver_standings")
        .select("driver_id, constructor_id, standing_position, points, wins, round")
        .eq("season", season)
        .order("round", { ascending: true })
        .limit(1000),
      sb
        .from("constructor_standings")
        .select("constructor_id, standing_position, points, wins, round")
        .eq("season", season)
        .order("round", { ascending: true })
        .limit(1000),
      sb
        .from("race_results")
        .select("race_id, driver_id, constructor_id, grid_position, finish_position, points, finish_status")
        .like("race_id", `${season}-%`)
        .limit(1000),
      sb.from("sprint_results").select("race_id, driver_id, finish_position, points").like("race_id", `${season}-%`).limit(1000),
      sb.from("constructors").select("id, name").limit(200),
      sb.from("races").select("id, round, race_name, circuit_id").eq("season", season).order("round", { ascending: true }),
    ]);

  const { byId } = idx;
  const ident = (id: string) => byId.get(id) ?? { id, code: id.slice(0, 3).toUpperCase(), name: id };
  const consName = new Map<string, string>();
  for (const c of (cons ?? []) as Row[]) consName.set(String(c["id"]), String(c["name"]));

  const rounds = [...new Set(((ds ?? []) as Row[]).map((r) => Number(r["round"])))].sort((a, b) => a - b);
  const latest = rounds[rounds.length - 1] ?? 0;

  type Agg = {
    wins: number;
    podiums: number;
    top10: number;
    dnf: number;
    starts: number;
    bestFinish: number | null;
    gridSum: number;
    finishSum: number;
    counted: number;
    sprintPoints: number;
  };
  const agg = new Map<string, Agg>();
  const blank = (): Agg => ({
    wins: 0,
    podiums: 0,
    top10: 0,
    dnf: 0,
    starts: 0,
    bestFinish: null,
    gridSum: 0,
    finishSum: 0,
    counted: 0,
    sprintPoints: 0,
  });
  for (const r of (rr ?? []) as Row[]) {
    const id = String(r["driver_id"]);
    const a = agg.get(id) ?? blank();
    const fin = num(r["finish_position"]);
    const grid = num(r["grid_position"]);
    a.starts += 1;
    if (fin != null) {
      if (fin === 1) a.wins += 1;
      if (fin <= 3) a.podiums += 1;
      if (fin <= 10) a.top10 += 1;
      a.bestFinish = a.bestFinish == null ? fin : Math.min(a.bestFinish, fin);
      a.finishSum += fin;
      if (grid != null) {
        a.gridSum += grid;
        a.counted += 1;
      }
    }
    if (String(r["finish_status"] ?? "").toLowerCase() !== "finished" && fin == null) a.dnf += 1;
    agg.set(id, a);
  }
  for (const r of (sr ?? []) as Row[]) {
    const id = String(r["driver_id"]);
    const a = agg.get(id) ?? blank();
    a.sprintPoints += Number(r["points"] ?? 0);
    agg.set(id, a);
  }

  const latestDrivers = ((ds ?? []) as Row[]).filter((r) => Number(r["round"]) === latest);
  const leaderPoints = Math.max(0, ...latestDrivers.map((r) => Number(r["points"] ?? 0)));

  const drivers = latestDrivers
    .map((r) => {
      const who = ident(String(r["driver_id"]));
      const a = agg.get(who.id) ?? blank();
      return {
        code: who.code,
        name: who.name,
        driverId: who.id,
        team: consName.get(String(r["constructor_id"])) ?? String(r["constructor_id"]),
        position: Number(r["standing_position"] ?? 0),
        points: Number(r["points"] ?? 0),
        gapToLeader: Number(r["points"] ?? 0) - leaderPoints,
        wins: a.wins,
        podiums: a.podiums,
        top10: a.top10,
        dnf: a.dnf,
        starts: a.starts,
        bestFinish: a.bestFinish,
        avgGrid: a.counted ? a.gridSum / a.counted : null,
        avgFinish: a.counted ? a.finishSum / a.counted : null,
        sprintPoints: a.sprintPoints,
      };
    })
    .sort((a, b) => a.position - b.position);

  const progression = rounds.map((round) => ({
    round,
    entries: ((ds ?? []) as Row[])
      .filter((r) => Number(r["round"]) === round)
      .map((r) => ({
        code: ident(String(r["driver_id"])).code,
        points: Number(r["points"] ?? 0),
        position: Number(r["standing_position"] ?? 0),
      })),
  }));

  const consRounds = [...new Set(((cs ?? []) as Row[]).map((r) => Number(r["round"])))].sort((a, b) => a - b);
  const consLatest = consRounds[consRounds.length - 1] ?? 0;
  const constructors = ((cs ?? []) as Row[])
    .filter((r) => Number(r["round"]) === consLatest)
    .map((r) => ({
      id: String(r["constructor_id"]),
      name: consName.get(String(r["constructor_id"])) ?? String(r["constructor_id"]),
      position: Number(r["standing_position"] ?? 0),
      points: Number(r["points"] ?? 0),
      wins: Number(r["wins"] ?? 0),
    }))
    .sort((a, b) => a.position - b.position);

  const constructorProgression = consRounds.map((round) => ({
    round,
    entries: ((cs ?? []) as Row[])
      .filter((r) => Number(r["round"]) === round)
      .map((r) => ({
        id: String(r["constructor_id"]),
        name: consName.get(String(r["constructor_id"])) ?? String(r["constructor_id"]),
        points: Number(r["points"] ?? 0),
      })),
  }));

  const winnersByRound = ((races ?? []) as Row[]).map((r) => {
    const winner = ((rr ?? []) as Row[]).find(
      (x) => String(x["race_id"]) === String(r["id"]) && Number(x["finish_position"]) === 1,
    );
    return {
      round: Number(r["round"]),
      name: String(r["race_name"] ?? ""),
      circuit: prettyCircuit(String(r["circuit_id"] ?? "")),
      winnerCode: winner ? ident(String(winner["driver_id"])).code : null,
      winnerTeam: winner ? (consName.get(String(winner["constructor_id"])) ?? null) : null,
    };
  });

  return {
    season,
    round: latest,
    drivers,
    constructors,
    progression,
    constructorProgression,
    winnersByRound,
  };
}

/* ------------------------------------------------------------------ */
/* Head to head                                                        */
/* ------------------------------------------------------------------ */

export type TrafficSplit = {
  code: string;
  cleanAirLaps: number;
  trafficLaps: number;
  uncertainLaps: number;
  cleanAirPaceS: number | null;
  trafficPaceS: number | null;
  dirtyAirCostS: number | null;
  worstDirtyAirS: number | null;
};

/** Clean-air vs in-traffic pace split from race_analysis_traffic_proxy. */
async function fetchTrafficSplit(sb: SB, slug: string, codes: string[]): Promise<TrafficSplit[]> {
  // One query per driver: the table holds ~3k rows per race, well past the
  // 1000-row API cap, so a combined query silently drops the second driver.
  const perDriver = await Promise.all(
    codes.map((code) =>
      sb
        .from("race_analysis_traffic_proxy")
        .select("driver, lap_number, normalized_pace_delta_s, dirty_air_proxy_s, traffic_proxy_label")
        .eq("race_analysis_id", slug)
        .eq("driver", code)
        .limit(1000),
    ),
  );
  const data = perDriver.flatMap((r) => r.data ?? []);

  const med = (xs: number[]) => {
    if (!xs.length) return null;
    const s = [...xs].sort((x, y) => x - y);
    return s[Math.floor(s.length / 2)]!;
  };

  return codes.map((code) => {
    const rows = ((data ?? []) as Row[]).filter(
      (r) => String(r["driver"] ?? "").toUpperCase() === code,
    );
    const clean: number[] = [];
    const traffic: number[] = [];
    let uncertain = 0;
    const dirty: number[] = [];
    for (const r of rows) {
      const label = String(r["traffic_proxy_label"] ?? "").toLowerCase();
      const pace = num(r["normalized_pace_delta_s"]);
      const d = num(r["dirty_air_proxy_s"]);
      if (d != null) dirty.push(d);
      if (pace == null) continue;
      if (label.includes("clean")) clean.push(pace);
      else if (label.includes("traffic")) traffic.push(pace);
      else uncertain += 1;
    }
    const cleanMed = med(clean);
    const trafficMed = med(traffic);
    return {
      code,
      cleanAirLaps: clean.length,
      trafficLaps: traffic.length,
      uncertainLaps: uncertain,
      cleanAirPaceS: cleanMed,
      trafficPaceS: trafficMed,
      dirtyAirCostS: cleanMed != null && trafficMed != null ? trafficMed - cleanMed : null,
      worstDirtyAirS: dirty.length ? Math.max(...dirty) : null,
    };
  });
}

export type TrafficLap = {
  lap: number;
  position: number | null;
  lapTimeS: number | null;
  paceDeltaS: number | null;
  dirtyAirS: number | null;
  label: string | null;
  phase: string | null;
};

/** Raw per-lap traffic-proxy rows for one driver (no smoothing, no estimates). */
async function fetchTrafficLaps(sb: SB, slug: string, code: string): Promise<TrafficLap[]> {
  const { data } = await sb
    .from("race_analysis_traffic_proxy")
    .select("lap_number, position, lap_time_s, normalized_pace_delta_s, dirty_air_proxy_s, traffic_proxy_label, phase")
    .eq("race_analysis_id", slug)
    .eq("driver", code)
    .limit(1000);
  const keyed = new Map<number, TrafficLap>();
  for (const r of (data ?? []) as Row[]) {
    const lap = Number(r["lap_number"] ?? 0);
    if (!Number.isFinite(lap) || lap <= 0) continue;
    keyed.set(lap, {
      lap,
      position: num(r["position"]),
      lapTimeS: num(r["lap_time_s"]),
      paceDeltaS: num(r["normalized_pace_delta_s"]),
      dirtyAirS: num(r["dirty_air_proxy_s"]),
      label: str(r["traffic_proxy_label"]),
      phase: str(r["phase"]),
    });
  }
  return [...keyed.values()].sort((a, b) => a.lap - b.lap);
}

export type PositionLap = {
  lap: number;
  position: number | null;
  deltaFromStart: number | null;
  deltaFromPrevious: number | null;
  status: string | null;
  phase: string | null;
};

/** Raw lap-by-lap running order for one driver. */
async function fetchPositionLaps(sb: SB, slug: string, code: string): Promise<PositionLap[]> {
  const { data } = await sb
    .from("race_analysis_position_timeline")
    .select(
      "lap_number, position, position_delta_from_start, position_delta_from_previous_lap, track_status_label, phase",
    )
    .eq("race_analysis_id", slug)
    .eq("driver", code)
    .limit(1000);
  const keyed = new Map<number, PositionLap>();
  for (const r of (data ?? []) as Row[]) {
    const lap = Number(r["lap_number"] ?? 0);
    if (!Number.isFinite(lap) || lap <= 0) continue;
    keyed.set(lap, {
      lap,
      position: num(r["position"]),
      deltaFromStart: num(r["position_delta_from_start"]),
      deltaFromPrevious: num(r["position_delta_from_previous_lap"]),
      status: str(r["track_status_label"]),
      phase: str(r["phase"]),
    });
  }
  return [...keyed.values()].sort((a, b) => a.lap - b.lap);
}

export type SwingEvent = {
  code: string;
  startLap: number | null;
  endLap: number | null;
  delta: number | null;
  type: string | null;
  phase: string | null;
  note: string | null;
};

export type CornerComparison = {
  sessionId: string;
  session: string;
  segmentId: string;
  cornerNumber: number | null;
  label: string;
  kind: string;
  driverA: string;
  driverB: string;
  faster: string | null;
  entryDeltaKph: number | null;
  apexDeltaKph: number | null;
  exitDeltaKph: number | null;
  minDeltaKph: number | null;
  entrySpeedA: number | null;
  entrySpeedB: number | null;
  apexSpeedA: number | null;
  apexSpeedB: number | null;
  exitSpeedA: number | null;
  exitSpeedB: number | null;
  minSpeedA: number | null;
  minSpeedB: number | null;
  entryGearA: number | null;
  entryGearB: number | null;
  apexGearA: number | null;
  apexGearB: number | null;
  exitGearA: number | null;
  exitGearB: number | null;
  brakingStartDeltaM: number | null;
  brakingDurationDeltaS: number | null;
  throttlePickupDeltaM: number | null;
  tractionDelta: number | null;
  confidence: number | null;
};

/** Raw position-swing events for the two compared drivers. */
async function fetchSwings(sb: SB, slug: string, codes: string[]): Promise<SwingEvent[]> {
  const per = await Promise.all(
    codes.map((code) =>
      sb
        .from("race_analysis_position_swing_events")
        .select("driver, start_lap, end_lap, position_delta, event_type, phase, note")
        .eq("race_analysis_id", slug)
        .eq("driver", code)
        .limit(200),
    ),
  );
  return per
    .flatMap((r) => (r.data ?? []) as Row[])
    .map((r) => ({
      code: String(r["driver"] ?? "").toUpperCase(),
      startLap: num(r["start_lap"]),
      endLap: num(r["end_lap"]),
      delta: num(r["position_delta"]),
      type: str(r["event_type"]),
      phase: str(r["phase"]),
      note: str(r["note"]),
    }))
    .sort((a, b) => (a.startLap ?? 0) - (b.startLap ?? 0));
}

async function fetchCornerComparisons(
  sb: SB,
  season: number,
  round: number,
  codeA: string,
  codeB: string,
): Promise<CornerComparison[]> {
  try {
    const { data: sessions, error: sessionError } = await sb
      .from("analytics_session_index")
      .select("session_id, session")
      .eq("season", season)
      .eq("round", round)
      .in("session", ["Q", "SQ", "S", "R"])
      .limit(12);
    if (sessionError) return [];

    const sessionIds = ((sessions ?? []) as Row[])
      .map((r) => String(r["session_id"] ?? ""))
      .filter(Boolean);
    if (!sessionIds.length) return [];
    const sessionById = new Map(
      ((sessions ?? []) as Row[])
        .map((r) => [String(r["session_id"] ?? ""), String(r["session"] ?? "")])
        .filter(([sessionId, sessionName]) => sessionId && sessionName),
    );

    const left = codeA < codeB ? codeA : codeB;
    const right = codeA < codeB ? codeB : codeA;
    const invert = left !== codeA;

    const [segments, braking, throttle] = await Promise.all([
      sb
        .from("analytics_segment_comparison")
        .select("*")
        .in("session_id", sessionIds)
        .eq("driver_a", left)
        .eq("driver_b", right)
        .order("segment_id", { ascending: true })
        .limit(240),
      sb
        .from("analytics_braking_comparison")
        .select("*")
        .in("session_id", sessionIds)
        .eq("driver_a", left)
        .eq("driver_b", right)
        .limit(240),
      sb
        .from("analytics_throttle_comparison")
        .select("*")
        .in("session_id", sessionIds)
        .eq("driver_a", left)
        .eq("driver_b", right)
        .limit(240),
    ]);
    if (segments.error) return [];

    const keyOf = (r: Row) => `${String(r["session_id"])}|${String(r["segment_id"])}`;
    const brakingByKey = new Map(((braking.data ?? []) as Row[]).map((r) => [keyOf(r), r]));
    const throttleByKey = new Map(((throttle.data ?? []) as Row[]).map((r) => [keyOf(r), r]));
    const signed = (value: unknown) => {
      const n = num(value);
      return n == null ? null : invert ? -n : n;
    };
    const gear = (row: Row, side: "a" | "b", key: string) =>
      num(row[`${key}_${invert ? (side === "a" ? "b" : "a") : side}`]);
    const absolute = (row: Row, side: "a" | "b", key: string) =>
      num(row[`${key}_${invert ? (side === "a" ? "b" : "a") : side}`]);
    const cornerNumberFromSegment = (segmentId: string) => {
      const match = segmentId.match(/(?:corner|segment|turn)[_-]?(\d+)/i) ?? segmentId.match(/(\d+)(?!.*\d)/);
      return match ? Number.parseInt(match[1], 10) : null;
    };
    const labelFromSegment = (segmentId: string) => {
      const cornerNumber = cornerNumberFromSegment(segmentId);
      return cornerNumber == null ? segmentId.replaceAll("_", " ") : `T${cornerNumber}`;
    };

    return ((segments.data ?? []) as Row[]).map((r) => {
      const key = keyOf(r);
      const bRow = brakingByKey.get(key);
      const tRow = throttleByKey.get(key);
      const faster = String(r["faster_driver"] ?? "");
      const segmentId = String(r["segment_id"] ?? "");
      const sessionId = String(r["session_id"] ?? "");
      return {
        sessionId,
        session: sessionById.get(sessionId) ?? "",
        segmentId,
        cornerNumber: cornerNumberFromSegment(segmentId),
        label: labelFromSegment(segmentId),
        kind: String(r["segment_kind"] ?? "corner"),
        driverA: codeA,
        driverB: codeB,
        faster: faster ? (faster === left ? left : right) : null,
        entryDeltaKph: signed(r["entry_speed_delta_kph"]),
        apexDeltaKph: signed(r["apex_speed_delta_kph"]),
        exitDeltaKph: signed(r["exit_speed_delta_kph"]),
        minDeltaKph: signed(r["min_speed_delta_kph"]),
        entrySpeedA: absolute(r, "a", "entry_speed_kph"),
        entrySpeedB: absolute(r, "b", "entry_speed_kph"),
        apexSpeedA: absolute(r, "a", "apex_speed_kph"),
        apexSpeedB: absolute(r, "b", "apex_speed_kph"),
        exitSpeedA: absolute(r, "a", "exit_speed_kph"),
        exitSpeedB: absolute(r, "b", "exit_speed_kph"),
        minSpeedA: absolute(r, "a", "min_speed_kph"),
        minSpeedB: absolute(r, "b", "min_speed_kph"),
        entryGearA: gear(r, "a", "entry_gear"),
        entryGearB: gear(r, "b", "entry_gear"),
        apexGearA: gear(r, "a", "apex_gear"),
        apexGearB: gear(r, "b", "apex_gear"),
        exitGearA: gear(r, "a", "exit_gear"),
        exitGearB: gear(r, "b", "exit_gear"),
        brakingStartDeltaM: bRow ? signed(bRow["braking_start_delta_m"]) : null,
        brakingDurationDeltaS: bRow ? signed(bRow["braking_duration_delta_s"]) : null,
        throttlePickupDeltaM: tRow ? signed(tRow["throttle_pickup_delta_m"]) : null,
        tractionDelta: tRow ? signed(tRow["traction_exit_delta"]) : null,
        confidence: num(r["confidence"]),
      };
    });
  } catch {
    return [];
  }
}


export async function fetchHeadToHead(slug: string, codeA: string, codeB: string) {
  const weekend = await fetchWeekend(slug);
  if (!weekend) return null;
  const a = codeA.toUpperCase();
  const b = codeB.toUpperCase();
  const pick = <T extends { code: string }>(rows: T[], code: string) =>
    rows.filter((r) => r.code === code);

  const sb = serverClient();
  const [traffic, trafficLapsA, trafficLapsB, posLapsA, posLapsB, swings, cornerComparisons] = await Promise.all([
    fetchTrafficSplit(sb, slug, [a, b]),
    fetchTrafficLaps(sb, slug, a),
    fetchTrafficLaps(sb, slug, b),
    fetchPositionLaps(sb, slug, a),
    fetchPositionLaps(sb, slug, b),
    fetchSwings(sb, slug, [a, b]),
    fetchCornerComparisons(sb, weekend.season, weekend.round, a, b),
  ]);

  return {
    slug: weekend.slug,
    name: weekend.name,
    resultsOnly: weekend.resultsOnly,
    round: weekend.round,
    season: weekend.season,
    circuit: weekend.circuit,
    sprintWeekend: weekend.sprintWeekend,
    trackPath: weekend.trackPath,
    codes: [a, b] as [string, string],
    quali: [a, b].map((c) => weekend.qualifying.find((q) => q.code === c) ?? null),
    sprint: [a, b].map((c) => weekend.sprint.find((s) => s.code === c) ?? null),
    race: [a, b].map((c) => weekend.classification.find((r) => r.code === c) ?? null),
    positions: [a, b].map((c) => weekend.positions.find((p) => p.code === c) ?? null),
    pace: [a, b].map((c) => weekend.pace.find((p) => p.code === c) ?? null),
    stints: [pick(weekend.stints, a), pick(weekend.stints, b)],
    pits: [pick(weekend.pits, a), pick(weekend.pits, b)],
    laps: [pick(weekend.laps, a), pick(weekend.laps, b)],
    traffic: traffic as [TrafficSplit, TrafficSplit],
    trafficLaps: [trafficLapsA, trafficLapsB] as [TrafficLap[], TrafficLap[]],
    positionLaps: [posLapsA, posLapsB] as [PositionLap[], PositionLap[]],
    swings,
    cornerComparisons,
    statusPhases: weekend.statusPhases,
    entrants: weekend.classification.map((r) => ({ code: r.code, name: r.name, team: r.team })),
  };
}


/* ------------------------------------------------------------------ */
/* Season telemetry + legacy report helpers                            */
/* ------------------------------------------------------------------ */

export type DriverTelemetry = {
  driverCode: string;
  driverName: string;
  team: string;
  constructorName: string | null;
  position: number;
  points: number;
  wins: number;
  standingsRound: number;
  qualiGapS: number | null;
  qualiSamples: number | null;
  racePaceDeltaS: number | null;
  consistencyS: number | null;
  degS: number | null;
  avgFieldRank: number | null;
  bestLapS: number | null;
  lapSamples: number | null;
};

export type ConstructorStanding = {
  id: string;
  name: string;
  position: number;
  points: number;
  wins: number;
};

export type RaceOption = { id: string; round: number; name: string; circuit: string };

export type LapPoint = {
  driverCode: string;
  lap: number;
  lapTimeS: number | null;
  paceDeltaS: number | null;
  fuelCorrectedDeltaS: number | null;
  compound: string | null;
  stint: number | null;
  tyreAge: number | null;
};

export async function fetchSeasonTelemetry() {
  const sb = serverClient();
  const [tele, cons, races] = await Promise.all([
    sb
      .from("v_driver_season_telemetry")
      .select("*")
      .eq("season", SEASON)
      .order("standing_position", { ascending: true }),
    sb
      .from("constructor_standings")
      .select("constructor_id, standing_position, points, wins, round, constructors(name)")
      .eq("season", SEASON)
      .order("round", { ascending: false })
      .order("standing_position", { ascending: true })
      .limit(60),
    sb
      .from("race_analysis_index")
      .select("race_analysis_id, round, race_name, circuit")
      .eq("season", String(SEASON)),
  ]);

  const drivers: DriverTelemetry[] = ((tele.data ?? []) as Row[]).map((r) => ({
    driverCode: String(r["driver_code"]),
    driverName: String(r["driver_name"] ?? r["driver_code"]),
    team: String(r["team"] ?? ""),
    constructorName: str(r["constructor_name"]),
    position: Number(r["standing_position"] ?? 0),
    points: Number(r["points"] ?? 0),
    wins: Number(r["wins"] ?? 0),
    standingsRound: Number(r["standings_round"] ?? 0),
    qualiGapS: num(r["quali_gap_med_s"]),
    qualiSamples: num(r["quali_samples"]),
    racePaceDeltaS: num(r["race_pace_delta_s"]),
    consistencyS: num(r["pace_consistency_s"]),
    degS: num(r["deg_s_per_lap"]),
    avgFieldRank: num(r["avg_field_rank"]),
    bestLapS: num(r["best_lap_s"]),
    lapSamples: num(r["lap_samples"]),
  }));

  const latestRound = Math.max(0, ...((cons.data ?? []) as Row[]).map((r) => Number(r["round"] ?? 0)));
  const constructors: ConstructorStanding[] = ((cons.data ?? []) as Row[])
    .filter((r) => Number(r["round"] ?? 0) === latestRound)
    .map((r) => ({
      id: String(r["constructor_id"]),
      name: String((r["constructors"] as { name?: string } | null)?.name ?? r["constructor_id"]),
      position: Number(r["standing_position"] ?? 0),
      points: Number(r["points"] ?? 0),
      wins: Number(r["wins"] ?? 0),
    }));

  const raceOptions: RaceOption[] = ((races.data ?? []) as Row[])
    .map((r) => ({
      id: String(r["race_analysis_id"]),
      round: Number(r["round"] ?? 0),
      name: String(r["race_name"] ?? ""),
      circuit: String(r["circuit"] ?? ""),
    }))
    .sort((a, b) => b.round - a.round);

  return {
    season: SEASON,
    standingsRound: drivers[0]?.standingsRound ?? 0,
    constructorRound: latestRound,
    drivers,
    constructors,
    raceOptions,
  };
}

export async function fetchLapTrace(raceAnalysisId: string, codes: string[]) {
  const sb = serverClient();
  const { data: rows } = await sb
    .from("v_driver_lap_trace")
    .select(
      "driver_code, lap_number, lap_time_s, normalized_pace_delta_s, fuel_corrected_delta_s, compound, stint_number, tyre_age",
    )
    .eq("race_analysis_id", raceAnalysisId)
    .in("driver_code", codes)
    .limit(2000);

  const laps: LapPoint[] = ((rows ?? []) as Row[]).map((r) => ({
    driverCode: String(r["driver_code"]),
    lap: Number(r["lap_number"] ?? 0),
    lapTimeS: num(r["lap_time_s"]),
    paceDeltaS: num(r["normalized_pace_delta_s"]),
    fuelCorrectedDeltaS: num(r["fuel_corrected_delta_s"]),
    compound: str(r["compound"]),
    stint: num(r["stint_number"]),
    tyreAge: num(r["tyre_age"]),
  }));
  laps.sort((x, y) => x.lap - y.lap);
  return { raceAnalysisId, laps };
}

export type RaceReportRow = {
  slug: string;
  round: number;
  name: string;
  circuit: string;
  dateISO: string;
  winnerCode: string;
  winnerName: string;
  winnerTeam: string;
  podium: string[];
  strategy: string | null;
  compoundPath: string | null;
  raceShape: string | null;
  story: string | null;
  weather: string | null;
  paceFactor: string | null;
  strategyFactor: string | null;
  positionFactor: string | null;
  confidence: string | null;
  weakestAssumption: string | null;
};

export type StintRow = {
  driver: string;
  team: string;
  stint: number;
  compound: string | null;
  startLap: number | null;
  endLap: number | null;
  length: number | null;
  medianLapS: number | null;
  degS: number | null;
};

function mapReport(r: Row, s: Row | undefined, names: Map<string, DriverIdentity>): RaceReportRow {
  const winner = String(r["winner"] ?? "");
  return {
    slug: String(r["race_analysis_id"]),
    round: Number(r["round"] ?? 0),
    name: String(r["race_name"] ?? ""),
    circuit: prettyCircuit(String(r["circuit"] ?? "")),
    dateISO: String(r["race_date"] ?? ""),
    winnerCode: winner,
    winnerName: names.get(winner.toUpperCase())?.name ?? winner,
    winnerTeam: String(r["winner_team"] ?? ""),
    podium: String(s?.["podium"] ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
    strategy: str(s?.["dominant_strategy"]),
    compoundPath: str(s?.["winning_compound_path"]),
    raceShape: str(s?.["race_shape"]),
    story: str(s?.["primary_story"]),
    weather: str(s?.["weather_summary"]),
    paceFactor: str(s?.["key_pace_factor"]),
    strategyFactor: str(s?.["key_strategy_factor"]),
    positionFactor: str(s?.["key_position_factor"]),
    confidence: str(s?.["confidence"]),
    weakestAssumption: str(s?.["weakest_assumption"]),
  };
}

export async function fetchRaceReports() {
  const sb = serverClient();
  const [idx, sum, ids] = await Promise.all([
    sb
      .from("race_analysis_index")
      .select("race_analysis_id, round, race_name, circuit, race_date, winner, winner_team")
      .eq("season", String(SEASON)),
    sb.from("race_analysis_summary").select("*"),
    driverIndex(sb),
  ]);
  const rows = ((idx.data ?? []) as Row[]).sort((a, b) => Number(b["round"]) - Number(a["round"]));
  const byId = new Map<string, Row>();
  for (const s of (sum.data ?? []) as Row[]) byId.set(String(s["race_analysis_id"]), s);
  const reports = rows.map((r) => mapReport(r, byId.get(String(r["race_analysis_id"])), ids.byCode));

  // Rounds that are raced but not yet telemetry-analysed still have a stored
  // classification — surface them from race_results so the list stays current.
  const covered = new Set(reports.map((r) => r.round));
  const [{ data: races }, { data: winners }] = await Promise.all([
    sb
      .from("races")
      .select("id, round, race_name, circuit_id, scheduled_at")
      .eq("season", SEASON)
      .order("round", { ascending: true }),
    sb
      .from("race_results")
      .select("race_id, driver_id, constructor_id, finish_position")
      .like("race_id", `${SEASON}-%`)
      .lte("finish_position", 3)
      .order("finish_position", { ascending: true })
      .limit(1000),
  ]);
  const podiumByRace = new Map<string, Row[]>();
  for (const r of (winners ?? []) as Row[]) {
    const key = String(r["race_id"]);
    podiumByRace.set(key, [...(podiumByRace.get(key) ?? []), r]);
  }
  for (const r of (races ?? []) as Row[]) {
    const round = Number(r["round"]);
    if (covered.has(round)) continue;
    const podium = podiumByRace.get(String(r["id"])) ?? [];
    if (!podium.length) continue;
    const code = (id: string) => ids.byId.get(id)?.code ?? id.slice(0, 3).toUpperCase();
    reports.push(
      mapReport(
        {
          race_analysis_id: String(r["id"]),
          round,
          race_name: r["race_name"],
          circuit: r["circuit_id"],
          race_date: r["scheduled_at"],
          winner: code(String(podium[0]?.["driver_id"] ?? "")),
          winner_team: podium[0]?.["constructor_id"] ?? "",
        } as Row,
        { podium: podium.map((p) => code(String(p["driver_id"]))).join(", ") } as Row,
        ids.byCode,
      ),
    );
  }
  reports.sort((a, b) => b.round - a.round);
  return { reports };

}

export async function fetchRaceReport(slug: string) {
  const sb = serverClient();
  const [idx, sum, stints, pos, ids] = await Promise.all([
    sb
      .from("race_analysis_index")
      .select("race_analysis_id, round, race_name, circuit, race_date, winner, winner_team")
      .eq("race_analysis_id", slug)
      .maybeSingle(),
    sb.from("race_analysis_summary").select("*").eq("race_analysis_id", slug).maybeSingle(),
    sb
      .from("race_analysis_stints")
      .select(
        "driver, team, stint_number, compound, start_lap, end_lap, stint_length, median_lap_time_s, degradation_s_per_lap",
      )
      .eq("race_analysis_id", slug)
      .limit(400),
    sb
      .from("race_analysis_position_changes")
      .select("driver, team, start_position, finish_position, net_position_change")
      .eq("race_analysis_id", slug)
      .limit(40),
    driverIndex(sb),
  ]);

  if (!idx.data) return { report: null, stints: [] as StintRow[], positions: [] };

  const report = mapReport(idx.data as Row, (sum.data ?? undefined) as Row | undefined, ids.byCode);
  const stintRows: StintRow[] = ((stints.data ?? []) as Row[])
    .map((r) => ({
      driver: String(r["driver"] ?? ""),
      team: String(r["team"] ?? ""),
      stint: Number(r["stint_number"] ?? 0),
      compound: str(r["compound"]),
      startLap: num(r["start_lap"]),
      endLap: num(r["end_lap"]),
      length: num(r["stint_length"]),
      medianLapS: num(r["median_lap_time_s"]),
      degS: num(r["degradation_s_per_lap"]),
    }))
    .sort((a, b) => a.driver.localeCompare(b.driver) || a.stint - b.stint);

  const positions = ((pos.data ?? []) as Row[])
    .map((r) => ({
      driver: String(r["driver"] ?? ""),
      team: String(r["team"] ?? ""),
      start: num(r["start_position"]),
      finish: num(r["finish_position"]),
      net: num(r["net_position_change"]),
    }))
    .sort((a, b) => (a.finish ?? 99) - (b.finish ?? 99));

  return { report, stints: stintRows, positions };
}

/* ------------------------------------------------------------------ */
/* Picks (pit wall casino)                                             */
/* ------------------------------------------------------------------ */

export type PickEntrant = {
  driverId: string;
  code: string;
  name: string;
  team: string;
  standingPosition: number;
  points: number;
  wins: number;
  odds: number;
};

export type PickResults = {
  raceId: string;
  qualifying: (string | null)[]; // p1, p2, p3 driver ids
  sprintQualifyingP1: string | null;
  sprintRaceP1: string | null;
  race: (string | null)[];
  randomPositions: { position: number; driverId: string | null }[];
  fastestLapDriverId: string | null;
  fastestPitDriverId: string | null;
  fastestPitS: number | null;
};

export type PickChallenge = {
  raceId: string;
  season: number;
  round: number;
  raceName: string;
  circuit: string;
  circuitId: string;
  hasSprint: boolean;
  lockAtISO: string | null;
  scheduledAtISO: string | null;
  randomPositions: number[];
  results: PickResults | null;
};

const posOf = (rows: Row[], position: number) =>
  rows.find((r) => Number(r["finish_position"] ?? r["position"] ?? 0) === position);

export async function fetchPicksBoard(season: number) {
  const sb = serverClient();
  const [idx, { data: ch }, { data: races }, { data: standings }, { data: cons }] = await Promise.all([
    driverIndex(sb),
    sb
      .from("race_pick_challenges")
      .select("*")
      .eq("season", season)
      .order("round", { ascending: true }),
    sb
      .from("races")
      .select("id, round, race_name, circuit_id, scheduled_at, sprint_weekend")
      .eq("season", season)
      .order("round", { ascending: true }),
    sb
      .from("driver_standings")
      .select("driver_id, constructor_id, standing_position, points, wins, round")
      .eq("season", season)
      .order("round", { ascending: false })
      .limit(400),
    sb.from("constructors").select("id, name").limit(200),
  ]);

  const { byId } = idx;
  const ident = (id: string) => byId.get(id) ?? { id, code: id.slice(0, 3).toUpperCase(), name: id };
  const consName = new Map<string, string>();
  for (const c of (cons ?? []) as Row[]) consName.set(String(c["id"]), String(c["name"]));

  const stRows = (standings ?? []) as Row[];
  const latestRound = Math.max(0, ...stRows.map((r) => Number(r["round"] ?? 0)));
  const latest = stRows.filter((r) => Number(r["round"] ?? 0) === latestRound);
  const weights = latest.map((r) => Math.pow(Number(r["points"] ?? 0) + 6, 1.6));
  const weightSum = weights.reduce((a, b) => a + b, 0) || 1;
  const entrants: PickEntrant[] = latest
    .map((r, i) => {
      const who = ident(String(r["driver_id"]));
      const prob = Math.min(0.6, Math.max(0.005, (weights[i] ?? 1) / weightSum));
      return {
        driverId: who.id,
        code: who.code,
        name: who.name,
        team: consName.get(String(r["constructor_id"])) ?? String(r["constructor_id"]),
        standingPosition: Number(r["standing_position"] ?? 0),
        points: Number(r["points"] ?? 0),
        wins: Number(r["wins"] ?? 0),
        odds: Math.round((1 / prob) * 10) / 10,
      };
    })
    .sort((a, b) => a.standingPosition - b.standingPosition);

  const raceById = new Map<string, Row>();
  for (const r of (races ?? []) as Row[]) raceById.set(String(r["id"]), r);

  const [{ data: qr }, { data: rr }, { data: sr }, { data: pit }] = await Promise.all([
    sb
      .from("qualifying_results")
      .select("race_id, driver_id, position")
      .like("race_id", `${season}-%`)
      .lte("position", 3)
      .limit(500),
    sb
      .from("race_results")
      .select("race_id, driver_id, finish_position, fastest_lap_rank")
      .like("race_id", `${season}-%`)
      .limit(1000),
    sb
      .from("sprint_results")
      .select("race_id, driver_id, grid_position, finish_position")
      .like("race_id", `${season}-%`)
      .limit(500),
    sb
      .from("race_pit_stop_results")
      .select("race_id, driver_id, pit_duration_s")
      .eq("season", season)
      .limit(500),
  ]);

  const challenges: PickChallenge[] = ((ch ?? []) as Row[]).map((c) => {
    const raceId = String(c["race_id"]);
    const race = raceById.get(raceId);
    const randoms = [num(c["random_position_1"]), num(c["random_position_2"])]
      .filter((x): x is number => x != null);
    const qRows = ((qr ?? []) as Row[]).filter((r) => String(r["race_id"]) === raceId);
    const rRows = ((rr ?? []) as Row[]).filter((r) => String(r["race_id"]) === raceId);
    const sRows = ((sr ?? []) as Row[]).filter((r) => String(r["race_id"]) === raceId);
    const pRows = ((pit ?? []) as Row[]).filter((r) => String(r["race_id"]) === raceId);
    const bestPit = pRows
      .map((r) => ({ id: String(r["driver_id"]), s: num(r["pit_duration_s"]) }))
      .filter((x) => x.s != null)
      .sort((x, y) => x.s! - y.s!)[0];

    const results: PickResults | null = rRows.length
      ? {
          raceId,
          qualifying: [1, 2, 3].map((p) => {
            const row = posOf(qRows, p);
            return row ? String(row["driver_id"]) : null;
          }),
          sprintQualifyingP1:
            (() => {
              const row = sRows.find((r) => Number(r["grid_position"] ?? 0) === 1);
              return row ? String(row["driver_id"]) : null;
            })(),
          sprintRaceP1:
            (() => {
              const row = posOf(sRows, 1);
              return row ? String(row["driver_id"]) : null;
            })(),
          race: [1, 2, 3].map((p) => {
            const row = posOf(rRows, p);
            return row ? String(row["driver_id"]) : null;
          }),
          randomPositions: randoms.map((p) => {
            const row = posOf(rRows, p);
            return { position: p, driverId: row ? String(row["driver_id"]) : null };
          }),
          fastestLapDriverId:
            (() => {
              const row = rRows.find((r) => Number(r["fastest_lap_rank"] ?? 0) === 1);
              return row ? String(row["driver_id"]) : null;
            })(),
          fastestPitDriverId: bestPit ? bestPit.id : null,
          fastestPitS: bestPit?.s ?? null,
        }
      : null;

    const circuitId = race ? String(race["circuit_id"]) : raceId.split("-").slice(2).join("-");
    return {
      raceId,
      season: Number(c["season"] ?? season),
      round: Number(c["round"] ?? 0),
      raceName: race ? String(race["race_name"] ?? raceId) : raceId,
      circuitId,
      circuit: prettyCircuit(circuitId),
      hasSprint: race ? Boolean(race["sprint_weekend"]) || sRows.length > 0 : sRows.length > 0,
      lockAtISO: str(c["qualifying_lock_at"]),
      scheduledAtISO: race ? str(race["scheduled_at"]) : null,
      randomPositions: randoms,
      results,
    };
  });

  const open = challenges.filter((c) => !c.results);
  const active = open[0] ?? challenges[challenges.length - 1] ?? null;

  return {
    season,
    entrants,
    standingsRound: latestRound,
    challenges,
    activeRaceId: active?.raceId ?? null,
  };
}
