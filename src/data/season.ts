// Local demo dataset for the F1 InsightX concept build.
// Mirrors the shape of the real pipeline output (season_state.json + CSV snapshots)
// so the UI can be swapped onto live data without layout changes.

export const seasonState = {
  season: 2026,
  resultsThrough: { round: 11, name: "Hungarian Grand Prix", date: "2026-07-26" },
  raceWeekRound: 12,
  snapshotISO: "2026-07-31T22:10:00Z",
  pipelineRunISO: "2026-07-31T22:10:00Z",
};

export const nextRace = {
  round: 12,
  totalRounds: 24,
  name: "Dutch Grand Prix",
  shortName: "Dutch GP",
  circuit: "Circuit Zandvoort",
  country: "Netherlands",
  timeZone: "Europe/Amsterdam",
  raceStartISO: "2026-08-23T13:00:00Z",
  laps: 72,
  lapKm: 4.259,
  // 2026 regulations: DRS is gone — active aero (X/Z mode) plus manual
  // override energy boost zones replace it.
  overrideZones: 2,
  activeAero: true,
  conditions: {
    rainRiskPct: 38,
    airTempC: 21.4,
    trackTempC: 31.8,
    windKph: 24,
    windDir: "NW",
  },
  pitWindow: "L26–L33",
  sessions: [
    { code: "FP1", label: "Practice 1", startISO: "2026-08-21T10:30:00Z", status: "scheduled" },
    { code: "FP2", label: "Practice 2", startISO: "2026-08-21T14:00:00Z", status: "scheduled" },
    { code: "FP3", label: "Practice 3", startISO: "2026-08-22T09:30:00Z", status: "scheduled" },
    { code: "Q", label: "Qualifying", startISO: "2026-08-22T13:00:00Z", status: "scheduled" },
    { code: "R", label: "Race", startISO: "2026-08-23T13:00:00Z", status: "scheduled" },
  ],
} as const;

export type TeamKey =
  | "mercedes"
  | "ferrari"
  | "mclaren"
  | "red-bull"
  | "aston-martin"
  | "williams"
  | "alpine"
  | "racing-bulls"
  | "sauber"
  | "haas";

export const teams: Record<TeamKey, { name: string; short: string; color: string }> = {
  mercedes: { name: "Mercedes", short: "MER", color: "#00d7b6" },
  ferrari: { name: "Ferrari", short: "FER", color: "#e8002d" },
  mclaren: { name: "McLaren", short: "MCL", color: "#ff8000" },
  "red-bull": { name: "Red Bull Racing", short: "RBR", color: "#3671c6" },
  "aston-martin": { name: "Aston Martin", short: "AMR", color: "#00665f" },
  williams: { name: "Williams", short: "WIL", color: "#64c4ff" },
  alpine: { name: "Alpine", short: "ALP", color: "#ff87bc" },
  "racing-bulls": { name: "Racing Bulls", short: "RB", color: "#6692ff" },
  sauber: { name: "Sauber", short: "SAU", color: "#52e252" },
  haas: { name: "Haas", short: "HAA", color: "#b6babd" },
};

export const constructorStandings = [
  { pos: 1, team: "mercedes" as TeamKey, points: 331, wins: 5, form: [1, 1, 2, 1, 3] },
  { pos: 2, team: "ferrari" as TeamKey, points: 288, wins: 3, form: [2, 3, 1, 2, 1] },
  { pos: 3, team: "mclaren" as TeamKey, points: 271, wins: 2, form: [3, 2, 3, 4, 2] },
  { pos: 4, team: "red-bull" as TeamKey, points: 214, wins: 1, form: [4, 4, 4, 3, 4] },
  { pos: 5, team: "aston-martin" as TeamKey, points: 96, wins: 0, form: [6, 5, 5, 5, 5] },
  { pos: 6, team: "williams" as TeamKey, points: 71, wins: 0, form: [5, 7, 6, 7, 6] },
  { pos: 7, team: "racing-bulls" as TeamKey, points: 44, wins: 0, form: [8, 6, 8, 6, 8] },
  { pos: 8, team: "alpine" as TeamKey, points: 29, wins: 0, form: [7, 9, 7, 9, 7] },
  { pos: 9, team: "sauber" as TeamKey, points: 22, wins: 0, form: [9, 8, 10, 8, 9] },
  { pos: 10, team: "haas" as TeamKey, points: 15, wins: 0, form: [10, 10, 9, 10, 10] },
];

export const driverStandings = [
  { pos: 1, code: "RUS", name: "George Russell", team: "mercedes" as TeamKey, points: 189, wins: 4 },
  { pos: 2, code: "LEC", name: "Charles Leclerc", team: "ferrari" as TeamKey, points: 167, wins: 2 },
  { pos: 3, code: "NOR", name: "Lando Norris", team: "mclaren" as TeamKey, points: 154, wins: 2 },
  { pos: 4, code: "ANT", name: "Kimi Antonelli", team: "mercedes" as TeamKey, points: 142, wins: 1 },
  { pos: 5, code: "VER", name: "Max Verstappen", team: "red-bull" as TeamKey, points: 138, wins: 1 },
  { pos: 6, code: "HAM", name: "Lewis Hamilton", team: "ferrari" as TeamKey, points: 121, wins: 1 },
  { pos: 7, code: "PIA", name: "Oscar Piastri", team: "mclaren" as TeamKey, points: 117, wins: 0 },
  { pos: 8, code: "ALO", name: "Fernando Alonso", team: "aston-martin" as TeamKey, points: 58, wins: 0 },
  { pos: 9, code: "SAI", name: "Carlos Sainz", team: "williams" as TeamKey, points: 44, wins: 0 },
  { pos: 10, code: "HAD", name: "Isack Hadjar", team: "racing-bulls" as TeamKey, points: 31, wins: 0 },
];

export const qualiProjection = [
  { pos: 1, code: "RUS", name: "George Russell", team: "mercedes" as TeamKey, lap: "1:09.412", delta: "—", conf: 0.74 },
  { pos: 2, code: "LEC", name: "Charles Leclerc", team: "ferrari" as TeamKey, lap: "1:09.508", delta: "+0.096", conf: 0.66 },
  { pos: 3, code: "NOR", name: "Lando Norris", team: "mclaren" as TeamKey, lap: "1:09.571", delta: "+0.159", conf: 0.61 },
  { pos: 4, code: "VER", name: "Max Verstappen", team: "red-bull" as TeamKey, lap: "1:09.640", delta: "+0.228", conf: 0.58 },
  { pos: 5, code: "ANT", name: "Kimi Antonelli", team: "mercedes" as TeamKey, lap: "1:09.702", delta: "+0.290", conf: 0.55 },
  { pos: 6, code: "PIA", name: "Oscar Piastri", team: "mclaren" as TeamKey, lap: "1:09.744", delta: "+0.332", conf: 0.52 },
  { pos: 7, code: "HAM", name: "Lewis Hamilton", team: "ferrari" as TeamKey, lap: "1:09.803", delta: "+0.391", conf: 0.5 },
  { pos: 8, code: "ALO", name: "Fernando Alonso", team: "aston-martin" as TeamKey, lap: "1:10.084", delta: "+0.672", conf: 0.46 },
  { pos: 9, code: "SAI", name: "Carlos Sainz", team: "williams" as TeamKey, lap: "1:10.121", delta: "+0.709", conf: 0.44 },
  { pos: 10, code: "HAD", name: "Isack Hadjar", team: "racing-bulls" as TeamKey, lap: "1:10.233", delta: "+0.821", conf: 0.41 },
];

export type RaceReport = {
  round: number;
  slug: string;
  name: string;
  circuit: string;
  dateISO: string;
  winner: { code: string; name: string; team: TeamKey };
  margin: string;
  strategy: string;
  lede: string;
  keyReads: { label: string; value: string; note: string }[];
  stints: { code: string; team: TeamKey; plan: string }[];
};

export const raceReports: RaceReport[] = [
  {
    round: 11,
    slug: "hungarian-grand-prix",
    name: "Hungarian Grand Prix",
    circuit: "Hungaroring",
    dateISO: "2026-07-26T13:00:00Z",
    winner: { code: "LEC", name: "Charles Leclerc", team: "ferrari" },
    margin: "+2.418s",
    strategy: "Two-stop, medium → hard → hard",
    lede:
      "Ferrari won this on tyre temperature, not lap time. Leclerc gave up 0.3s per lap in the first stint to keep the rears alive, then took 0.6s per lap back in the middle third while Mercedes managed a graining front-left.",
    keyReads: [
      { label: "Decisive phase", value: "Laps 31–44", note: "Leclerc net +4.1s in clear air" },
      { label: "Tyre life", value: "Hard, 27 laps", note: "0.019s/lap degradation" },
      { label: "Pit delta", value: "20.6s", note: "Undercut never viable after L30" },
    ],
    stints: [
      { code: "LEC", team: "ferrari", plan: "M 18 → H 27 → H 25" },
      { code: "RUS", team: "mercedes", plan: "M 21 → H 24 → H 25" },
      { code: "NOR", team: "mclaren", plan: "M 16 → H 30 → H 24" },
    ],
  },
  {
    round: 10,
    slug: "british-grand-prix",
    name: "British Grand Prix",
    circuit: "Silverstone",
    dateISO: "2026-07-05T14:00:00Z",
    winner: { code: "RUS", name: "George Russell", team: "mercedes" },
    margin: "+7.902s",
    strategy: "One-stop, medium → hard",
    lede:
      "A dry-line race decided in Copse. Mercedes carried the most front wing of the top four and it paid in the high-speed sequence, where Russell was quickest through sectors 1 and 3 on 11 of his 22 hard-tyre laps.",
    keyReads: [
      { label: "Decisive phase", value: "Laps 8–14", note: "Russell +3.4s before first stop" },
      { label: "Top speed", value: "-6 km/h", note: "Traded for high-speed downforce" },
      { label: "Safety car", value: "None", note: "One-stop held comfortably" },
    ],
    stints: [
      { code: "RUS", team: "mercedes", plan: "M 26 → H 26" },
      { code: "VER", team: "red-bull", plan: "M 23 → H 29" },
      { code: "LEC", team: "ferrari", plan: "M 28 → H 24" },
    ],
  },
  {
    round: 9,
    slug: "canadian-grand-prix",
    name: "Canadian Grand Prix",
    circuit: "Circuit Gilles Villeneuve",
    dateISO: "2026-06-14T18:00:00Z",
    winner: { code: "NOR", name: "Lando Norris", team: "mclaren" },
    margin: "+1.106s",
    strategy: "Two-stop, soft → medium → medium",
    lede:
      "The only race this season where the model's pre-race read was beaten by strategy rather than pace. McLaren pitted Norris under a virtual safety car on lap 42 and converted a 1.9s deficit into a 1.1s win.",
    keyReads: [
      { label: "Decisive phase", value: "Lap 42 VSC", note: "Free stop worth 11.4s" },
      { label: "Traction zones", value: "+0.14s", note: "McLaren best out of turn 13" },
      { label: "Model miss", value: "P3 → P1", note: "Logged as a strategy exception" },
    ],
    stints: [
      { code: "NOR", team: "mclaren", plan: "S 14 → M 28 → M 28" },
      { code: "ANT", team: "mercedes", plan: "S 16 → M 26 → M 28" },
      { code: "HAM", team: "ferrari", plan: "S 12 → M 30 → M 28" },
    ],
  },
  {
    round: 8,
    slug: "spanish-grand-prix",
    name: "Spanish Grand Prix",
    circuit: "Circuit de Barcelona-Catalunya",
    dateISO: "2026-05-31T13:00:00Z",
    winner: { code: "RUS", name: "George Russell", team: "mercedes" },
    margin: "+11.674s",
    strategy: "Two-stop, medium → medium → hard",
    lede:
      "The clearest pace picture of the year so far: Mercedes were fastest in every sector on race fuel and the gap to Ferrari grew on every lap of the final stint.",
    keyReads: [
      { label: "Decisive phase", value: "Laps 45–66", note: "+0.21s/lap in clear air" },
      { label: "Deg delta", value: "0.011s/lap", note: "Lowest hard-tyre loss in the field" },
      { label: "Teammate gap", value: "+0.9s", note: "Antonelli closest all season" },
    ],
    stints: [
      { code: "RUS", team: "mercedes", plan: "M 20 → M 22 → H 24" },
      { code: "LEC", team: "ferrari", plan: "M 22 → M 21 → H 23" },
      { code: "PIA", team: "mclaren", plan: "M 18 → M 24 → H 24" },
    ],
  },
];
