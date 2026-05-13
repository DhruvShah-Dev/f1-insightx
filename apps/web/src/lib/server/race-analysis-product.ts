import "server-only";

import { cache } from "react";
import { parseBoolean, parseNumber, readOptionalCsvFile } from "@/lib/server/csv";

type Numeric = number | string | null | undefined;

type IndexRow = {
  race_analysis_id: string;
  season: Numeric;
  round: Numeric;
  event: string;
  race_name: string;
  session_id: string;
  circuit: string;
  race_date: string;
  winner: string;
  winner_team: string;
  driver_count: Numeric;
  classified_driver_count: Numeric;
  stint_count: Numeric;
  pit_stop_count: Numeric;
  weather_available: string;
  race_control_available: string;
  analysis_quality_score: Numeric;
  generated_at: string;
  build_version: string;
  freshness_status: string;
};

type SummaryRow = {
  race_analysis_id: string;
  winner: string;
  winner_team: string;
  podium: string;
  dominant_strategy: string;
  winning_compound_path: string;
  race_shape: string;
  primary_story: string;
  key_strategy_factor: string;
  key_pace_factor: string;
  key_position_factor: string;
  weather_summary: string;
  confidence: Numeric;
  weakest_assumption: string;
};

type StoryPointRow = {
  race_analysis_id: string;
  story_point_id: string;
  lap_number: Numeric;
  phase: string;
  title: string;
  summary: string;
  evidence_type: string;
  drivers_involved: string;
  teams_involved: string;
  related_metric: string;
  impact_score: Numeric;
  confidence: Numeric;
  data_limit_note: string;
};

type StintRow = {
  race_analysis_id: string;
  driver: string;
  team: string;
  stint_number: Numeric;
  compound: string;
  start_lap: Numeric;
  end_lap: Numeric;
  stint_length: Numeric;
  median_lap_time_s: Numeric;
  best_lap_time_s: Numeric;
  degradation_s_per_lap: Numeric;
  degradation_confidence: Numeric;
  pace_rank_in_stint: Numeric;
  traffic_adjusted_flag: string;
  stint_quality_score: Numeric;
};

type PitStrategyRow = {
  race_analysis_id: string;
  driver: string;
  team: string;
  pit_stop_number: Numeric;
  pit_lap: Numeric;
  compound_from: string;
  compound_to: string;
  net_position_change: Numeric;
  estimated_pit_loss_s: Numeric;
  undercut_overcut_label: string;
  rejoin_risk: string;
  traffic_penalty_proxy_s: Numeric;
  strategy_effect: string;
  confidence: Numeric;
  weakest_assumption: string;
};

type PaceEvolutionRow = {
  race_analysis_id: string;
  driver: string;
  team: string;
  lap_number: Numeric;
  race_phase: string;
  compound: string;
  rolling_pace_delta_s: Numeric;
  fuel_corrected_delta_s: Numeric;
  pace_confidence: Numeric;
};

type PositionTimelineRow = {
  race_analysis_id: string;
  driver: string;
  team: string;
  lap_number: Numeric;
  position: Numeric;
  position_delta_from_start: Numeric;
  phase: string;
  track_status_label: string;
  confidence: Numeric;
  evidence_type: string;
};

type PositionSwingRow = {
  race_analysis_id: string;
  event_id: string;
  driver: string;
  team: string;
  start_lap: Numeric;
  end_lap: Numeric;
  position_delta: Numeric;
  phase: string;
  event_type: string;
  evidence_type: string;
  confidence: Numeric;
  note: string;
};

type TrafficProxyRow = {
  race_analysis_id: string;
  driver: string;
  team: string;
  lap_number: Numeric;
  phase: string;
  position: Numeric;
  normalized_pace_delta_s: Numeric;
  traffic_proxy_label: string;
  dirty_air_proxy_s: Numeric;
  drs_window_proxy: string;
  confidence: Numeric;
  evidence_type: string;
  note: string;
};

type NeutralizationRow = {
  race_analysis_id: string;
  phase_id: string;
  start_lap: Numeric;
  end_lap: Numeric;
  status_label: string;
  affected_laps: Numeric;
  confidence: Numeric;
  evidence_type: string;
  cause_available: string;
  cause_note: string;
};

type WeatherContextRow = {
  race_analysis_id: string;
  lap_number: Numeric;
  race_phase: string;
  track_temp_c: Numeric;
  rainfall: string;
  weather_state: string;
  weather_impact_label: string;
  confidence: Numeric;
};

type LinkRow = {
  race_analysis_id: string;
  surface: string;
  label: string;
  href: string;
  relevance_note: string;
  enabled: string;
  unavailable_reason: string;
};

export type RaceAnalysisIndexItem = {
  id: string;
  season: number;
  round: number;
  raceName: string;
  circuit: string;
  raceDate: string | null;
  winner: string;
  winnerTeam: string;
  podium: string[];
  dominantStrategy: string;
  raceShape: string;
  weatherSummary: string;
  weatherAvailable: boolean;
  raceControlAvailable: boolean;
  analysisQualityScore: number | null;
  freshnessStatus: string;
  generatedAt: string | null;
};

export type RaceAnalysisStoryPoint = {
  id: string;
  lapNumber: number | null;
  phase: string;
  title: string;
  summary: string;
  evidenceType: string;
  driversInvolved: string | null;
  relatedMetric: string;
  impactScore: number | null;
  confidence: number | null;
  dataLimitNote: string | null;
};

export type RaceAnalysisStint = {
  driver: string;
  team: string;
  stintNumber: number | null;
  compound: string;
  startLap: number | null;
  endLap: number | null;
  stintLength: number | null;
  medianLapTimeS: number | null;
  bestLapTimeS: number | null;
  degradationSPerLap: number | null;
  degradationConfidence: number | null;
  paceRankInStint: number | null;
  trafficAdjusted: boolean;
  stintQualityScore: number | null;
};

export type RaceAnalysisPitStop = {
  driver: string;
  team: string;
  pitStopNumber: number | null;
  pitLap: number | null;
  compoundFrom: string;
  compoundTo: string;
  netPositionChange: number | null;
  estimatedPitLossS: number | null;
  undercutOvercutLabel: string;
  rejoinRisk: string;
  trafficPenaltyProxyS: number | null;
  strategyEffect: string;
  confidence: number | null;
  weakestAssumption: string;
};

export type RaceAnalysisPacePoint = {
  driver: string;
  team: string;
  lapNumber: number | null;
  racePhase: string;
  compound: string;
  rollingPaceDeltaS: number | null;
  fuelCorrectedDeltaS: number | null;
  paceConfidence: number | null;
};

export type RaceAnalysisPositionPoint = {
  driver: string;
  team: string;
  lapNumber: number | null;
  position: number | null;
  positionDeltaFromStart: number | null;
  phase: string;
  trackStatusLabel: string;
  confidence: number | null;
  evidenceType: string;
};

export type RaceAnalysisPositionSwing = {
  id: string;
  driver: string;
  team: string;
  startLap: number | null;
  endLap: number | null;
  positionDelta: number | null;
  phase: string;
  eventType: string;
  evidenceType: string;
  confidence: number | null;
  note: string;
};

export type RaceAnalysisTrafficPoint = {
  driver: string;
  team: string;
  lapNumber: number | null;
  phase: string;
  position: number | null;
  normalizedPaceDeltaS: number | null;
  trafficProxyLabel: string;
  dirtyAirProxyS: number | null;
  drsWindowProxy: string;
  confidence: number | null;
  note: string;
};

export type RaceAnalysisNeutralizationPhase = {
  id: string;
  startLap: number | null;
  endLap: number | null;
  statusLabel: string;
  affectedLaps: number | null;
  confidence: number | null;
  evidenceType: string;
  causeAvailable: boolean;
  causeNote: string;
};

export type RaceAnalysisWeatherPoint = {
  lapNumber: number | null;
  racePhase: string;
  trackTempC: number | null;
  rainfall: boolean;
  weatherState: string;
  weatherImpactLabel: string;
  confidence: number | null;
};

export type RaceAnalysisLink = {
  surface: string;
  label: string;
  href: string;
  relevanceNote: string;
  enabled: boolean;
  unavailableReason: string | null;
};

export type RaceAnalysisDetail = RaceAnalysisIndexItem & {
  summary: {
    primaryStory: string;
    keyStrategyFactor: string;
    keyPaceFactor: string;
    keyPositionFactor: string;
    winningCompoundPath: string;
    confidence: number | null;
    weakestAssumption: string;
  };
  storyPoints: RaceAnalysisStoryPoint[];
  stints: RaceAnalysisStint[];
  pitStops: RaceAnalysisPitStop[];
  paceEvolution: RaceAnalysisPacePoint[];
  positionTimeline: RaceAnalysisPositionPoint[];
  positionSwings: RaceAnalysisPositionSwing[];
  trafficProxy: RaceAnalysisTrafficPoint[];
  neutralizationPhases: RaceAnalysisNeutralizationPhase[];
  weatherContext: RaceAnalysisWeatherPoint[];
  links: RaceAnalysisLink[];
};

const detailCaps = {
  storyPoints: 8,
  stints: 42,
  pitStops: 34,
  paceEvolution: 180,
  positionTimeline: 220,
  positionSwings: 20,
  trafficProxy: 120,
  neutralizationPhases: 10,
  weatherContext: 80,
};

function num(value: Numeric) {
  return parseNumber(value === null || value === undefined ? undefined : String(value));
}

function splitPodium(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 3);
}

function byRace<T extends { race_analysis_id: string }>(rows: T[], raceId: string) {
  return rows.filter((row) => row.race_analysis_id === raceId);
}

function confidenceTier(value: number | null | undefined) {
  if (value === null || value === undefined) return "Limited data";
  if (value >= 0.85) return "Strong telemetry agreement";
  if (value >= 0.65) return "Moderate telemetry confidence";
  if (value >= 0.45) return "Traffic-adjusted inference";
  return "Limited clean-lap data";
}

export { confidenceTier as getRaceAnalysisConfidenceTier };

function safeHref(value: string) {
  return value.startsWith("/") ? encodeURI(value) : value;
}

function mapIndex(row: IndexRow, summary?: SummaryRow): RaceAnalysisIndexItem {
  return {
    id: row.race_analysis_id,
    season: num(row.season) ?? 0,
    round: num(row.round) ?? 0,
    raceName: row.race_name || row.event,
    circuit: row.circuit,
    raceDate: row.race_date || null,
    winner: row.winner,
    winnerTeam: row.winner_team,
    podium: splitPodium(summary?.podium ?? ""),
    dominantStrategy: summary?.dominant_strategy ?? "",
    raceShape: summary?.race_shape ?? "",
    weatherSummary: summary?.weather_summary ?? "",
    weatherAvailable: parseBoolean(row.weather_available),
    raceControlAvailable: parseBoolean(row.race_control_available),
    analysisQualityScore: num(row.analysis_quality_score),
    freshnessStatus: row.freshness_status,
    generatedAt: row.generated_at || null,
  };
}

const loadBaseRows = cache(async () => {
  const [index, summaries] = await Promise.all([
    readOptionalCsvFile<IndexRow>("raceAnalysis.index"),
    readOptionalCsvFile<SummaryRow>("raceAnalysis.summary"),
  ]);
  return { index, summaries };
});

export const listRaceAnalysisIndex = cache(async () => {
  const { index, summaries } = await loadBaseRows();
  const summaryById = new Map(summaries.map((row) => [row.race_analysis_id, row]));
  return index
    .map((row) => mapIndex(row, summaryById.get(row.race_analysis_id)))
    .sort((a, b) => (b.season - a.season) || (b.round - a.round));
});

export const getRaceAnalysisDetail = cache(async (raceId: string): Promise<RaceAnalysisDetail | null> => {
  const { index, summaries } = await loadBaseRows();
  const indexRow = index.find((row) => row.race_analysis_id === raceId);
  const summaryRow = summaries.find((row) => row.race_analysis_id === raceId);
  if (!indexRow || !summaryRow) {
    return null;
  }

  const [storyRows, stintRows, pitRows, paceRows, positionRows, swingRows, trafficRows, neutralRows, weatherRows, linkRows] = await Promise.all([
    readOptionalCsvFile<StoryPointRow>("raceAnalysis.storyPoints"),
    readOptionalCsvFile<StintRow>("raceAnalysis.stints"),
    readOptionalCsvFile<PitStrategyRow>("raceAnalysis.pitStrategy"),
    readOptionalCsvFile<PaceEvolutionRow>("raceAnalysis.paceEvolution"),
    readOptionalCsvFile<PositionTimelineRow>("raceAnalysis.positionTimeline"),
    readOptionalCsvFile<PositionSwingRow>("raceAnalysis.positionSwingEvents"),
    readOptionalCsvFile<TrafficProxyRow>("raceAnalysis.trafficProxy"),
    readOptionalCsvFile<NeutralizationRow>("raceAnalysis.neutralizationPhases"),
    readOptionalCsvFile<WeatherContextRow>("raceAnalysis.weatherContext"),
    readOptionalCsvFile<LinkRow>("raceAnalysis.links"),
  ]);

  const base = mapIndex(indexRow, summaryRow);
  const keyDrivers = new Set([base.winner, ...base.podium].filter(Boolean));
  const driverRank = (driver: string) => keyDrivers.has(driver) ? 0 : 1;

  return {
    ...base,
    summary: {
      primaryStory: summaryRow.primary_story,
      keyStrategyFactor: summaryRow.key_strategy_factor,
      keyPaceFactor: summaryRow.key_pace_factor,
      keyPositionFactor: summaryRow.key_position_factor,
      winningCompoundPath: summaryRow.winning_compound_path,
      confidence: num(summaryRow.confidence),
      weakestAssumption: summaryRow.weakest_assumption,
    },
    storyPoints: byRace(storyRows, raceId)
      .sort((a, b) => (num(a.lap_number) ?? 999) - (num(b.lap_number) ?? 999))
      .slice(0, detailCaps.storyPoints)
      .map((row) => ({
        id: row.story_point_id,
        lapNumber: num(row.lap_number),
        phase: row.phase,
        title: row.title,
        summary: row.summary,
        evidenceType: row.evidence_type,
        driversInvolved: row.drivers_involved || null,
        relatedMetric: row.related_metric,
        impactScore: num(row.impact_score),
        confidence: num(row.confidence),
        dataLimitNote: row.data_limit_note || null,
      })),
    stints: byRace(stintRows, raceId)
      .sort((a, b) => driverRank(a.driver) - driverRank(b.driver) || (num(a.stint_number) ?? 0) - (num(b.stint_number) ?? 0))
      .slice(0, detailCaps.stints)
      .map((row) => ({
        driver: row.driver,
        team: row.team,
        stintNumber: num(row.stint_number),
        compound: row.compound,
        startLap: num(row.start_lap),
        endLap: num(row.end_lap),
        stintLength: num(row.stint_length),
        medianLapTimeS: num(row.median_lap_time_s),
        bestLapTimeS: num(row.best_lap_time_s),
        degradationSPerLap: num(row.degradation_s_per_lap),
        degradationConfidence: num(row.degradation_confidence),
        paceRankInStint: num(row.pace_rank_in_stint),
        trafficAdjusted: parseBoolean(row.traffic_adjusted_flag),
        stintQualityScore: num(row.stint_quality_score),
      })),
    pitStops: byRace(pitRows, raceId)
      .sort((a, b) => Math.abs(num(a.net_position_change) ?? 0) > Math.abs(num(b.net_position_change) ?? 0) ? -1 : 1)
      .slice(0, detailCaps.pitStops)
      .map((row) => ({
        driver: row.driver,
        team: row.team,
        pitStopNumber: num(row.pit_stop_number),
        pitLap: num(row.pit_lap),
        compoundFrom: row.compound_from,
        compoundTo: row.compound_to,
        netPositionChange: num(row.net_position_change),
        estimatedPitLossS: num(row.estimated_pit_loss_s),
        undercutOvercutLabel: row.undercut_overcut_label,
        rejoinRisk: row.rejoin_risk,
        trafficPenaltyProxyS: num(row.traffic_penalty_proxy_s),
        strategyEffect: row.strategy_effect,
        confidence: num(row.confidence),
        weakestAssumption: row.weakest_assumption,
      })),
    paceEvolution: byRace(paceRows, raceId)
      .filter((row) => keyDrivers.has(row.driver))
      .filter((_, index) => index % 2 === 0)
      .slice(0, detailCaps.paceEvolution)
      .map((row) => ({
        driver: row.driver,
        team: row.team,
        lapNumber: num(row.lap_number),
        racePhase: row.race_phase,
        compound: row.compound,
        rollingPaceDeltaS: num(row.rolling_pace_delta_s),
        fuelCorrectedDeltaS: num(row.fuel_corrected_delta_s),
        paceConfidence: num(row.pace_confidence),
      })),
    positionTimeline: byRace(positionRows, raceId)
      .filter((row) => keyDrivers.has(row.driver))
      .filter((_, index) => index % 2 === 0)
      .slice(0, detailCaps.positionTimeline)
      .map((row) => ({
        driver: row.driver,
        team: row.team,
        lapNumber: num(row.lap_number),
        position: num(row.position),
        positionDeltaFromStart: num(row.position_delta_from_start),
        phase: row.phase,
        trackStatusLabel: row.track_status_label,
        confidence: num(row.confidence),
        evidenceType: row.evidence_type,
      })),
    positionSwings: byRace(swingRows, raceId)
      .sort((a, b) => Math.abs(num(b.position_delta) ?? 0) - Math.abs(num(a.position_delta) ?? 0))
      .slice(0, detailCaps.positionSwings)
      .map((row) => ({
        id: row.event_id,
        driver: row.driver,
        team: row.team,
        startLap: num(row.start_lap),
        endLap: num(row.end_lap),
        positionDelta: num(row.position_delta),
        phase: row.phase,
        eventType: row.event_type,
        evidenceType: row.evidence_type,
        confidence: num(row.confidence),
        note: row.note,
      })),
    trafficProxy: byRace(trafficRows, raceId)
      .filter((row) => keyDrivers.has(row.driver))
      .filter((_, index) => index % 3 === 0)
      .slice(0, detailCaps.trafficProxy)
      .map((row) => ({
        driver: row.driver,
        team: row.team,
        lapNumber: num(row.lap_number),
        phase: row.phase,
        position: num(row.position),
        normalizedPaceDeltaS: num(row.normalized_pace_delta_s),
        trafficProxyLabel: row.traffic_proxy_label,
        dirtyAirProxyS: num(row.dirty_air_proxy_s),
        drsWindowProxy: row.drs_window_proxy,
        confidence: num(row.confidence),
        note: row.note,
      })),
    neutralizationPhases: byRace(neutralRows, raceId)
      .slice(0, detailCaps.neutralizationPhases)
      .map((row) => ({
        id: row.phase_id,
        startLap: num(row.start_lap),
        endLap: num(row.end_lap),
        statusLabel: row.status_label,
        affectedLaps: num(row.affected_laps),
        confidence: num(row.confidence),
        evidenceType: row.evidence_type,
        causeAvailable: parseBoolean(row.cause_available),
        causeNote: row.cause_note,
      })),
    weatherContext: byRace(weatherRows, raceId)
      .filter((_, index) => index % 2 === 0)
      .slice(0, detailCaps.weatherContext)
      .map((row) => ({
        lapNumber: num(row.lap_number),
        racePhase: row.race_phase,
        trackTempC: num(row.track_temp_c),
        rainfall: parseBoolean(row.rainfall),
        weatherState: row.weather_state,
        weatherImpactLabel: row.weather_impact_label,
        confidence: num(row.confidence),
      })),
    links: byRace(linkRows, raceId).map((row) => ({
      surface: row.surface,
      label: row.label,
      href: safeHref(row.href),
      relevanceNote: row.relevance_note,
      enabled: parseBoolean(row.enabled),
      unavailableReason: row.unavailable_reason || null,
    })),
  };
});
