import { nextRace, seasonState } from "./season";

export type RaceWeekSession = {
  code: string;
  label: string;
  startISO: string;
  status: "scheduled" | "data_pending" | "complete";
  resultCount: number;
};

export type TrackAnnotation = {
  id: string;
  label: string;
  kind: "start_finish" | "sector" | "corner" | "pit" | "overtake";
  distanceM: number | null;
  sourceUrl: string;
  placement: "track_origin" | "lap_distance" | "reference_only";
};

export type TrackReference = {
  circuitId: string;
  season: number;
  lapKm: number;
  laps: number;
  turns: number;
  venueTimeZone: string;
  sourceUrl: string;
  distanceSourceUrl: string;
  annotations: TrackAnnotation[];
};

const FIA_VEGAS_2026 = "https://www.fia.com/system/files/decision-document/2026_las_vegas_grand_prix_-_power_unit_information.pdf";

const references: Record<string, TrackReference> = {
  vegas: {
    circuitId: "vegas",
    season: 2026,
    lapKm: 6.201,
    laps: 50,
    turns: 17,
    venueTimeZone: "America/Los_Angeles",
    sourceUrl: FIA_VEGAS_2026,
    distanceSourceUrl: "https://www.formula1.com/en/latest/article/formula-1-heineken-las-vegas-grand-prix-2026.1qmWzcBwKK5hkTbYbhVC22",
    annotations: [
      { id: "finish", label: "Start / finish", kind: "start_finish", distanceM: 0, sourceUrl: FIA_VEGAS_2026, placement: "track_origin" },
      { id: "overtake-detection", label: "Overtake detection line", kind: "overtake", distanceM: 5299, sourceUrl: FIA_VEGAS_2026, placement: "lap_distance" },
      { id: "overtake-activation", label: "Overtake activation line", kind: "overtake", distanceM: 5400, sourceUrl: FIA_VEGAS_2026, placement: "lap_distance" },
      { id: "sector-split-1", label: "Sector 1 split", kind: "sector", distanceM: null, sourceUrl: FIA_VEGAS_2026, placement: "reference_only" },
      { id: "sector-split-2", label: "Sector 2 split", kind: "sector", distanceM: null, sourceUrl: FIA_VEGAS_2026, placement: "reference_only" },
      { id: "corners", label: "Turns 1–17", kind: "corner", distanceM: null, sourceUrl: FIA_VEGAS_2026, placement: "reference_only" },
    ],
  },
};

export function trackReferenceFor(circuitId: string, season: number): TrackReference | null {
  const reference = references[circuitId];
  return reference?.season === season ? reference : null;
}

export function localRaceWeekSessions(round: number): RaceWeekSession[] {
  if (round !== nextRace.round || seasonState.season !== 2026) return [];
  return nextRace.sessions.map((session) => ({
    code: session.code,
    label: session.label,
    startISO: session.startISO,
    status: "scheduled",
    resultCount: 0,
  }));
}

// Compact 2025 Vegas result snapshot from data/curated/race_results.csv.
export const historicalVegas2025 = [
  { driverId: "max_verstappen", name: "Max Verstappen", grid: 2, finish: 1 },
  { driverId: "russell", name: "George Russell", grid: 4, finish: 2 },
  { driverId: "antonelli", name: "Kimi Antonelli", grid: 17, finish: 3 },
  { driverId: "leclerc", name: "Charles Leclerc", grid: 9, finish: 4 },
  { driverId: "sainz", name: "Carlos Sainz", grid: 3, finish: 5 },
  { driverId: "hadjar", name: "Isack Hadjar", grid: 8, finish: 6 },
  { driverId: "hulkenberg", name: "Nico Hülkenberg", grid: 11, finish: 7 },
  { driverId: "hamilton", name: "Lewis Hamilton", grid: 19, finish: 8 },
  { driverId: "ocon", name: "Esteban Ocon", grid: 13, finish: 9 },
  { driverId: "bearman", name: "Oliver Bearman", grid: 14, finish: 10 },
];
