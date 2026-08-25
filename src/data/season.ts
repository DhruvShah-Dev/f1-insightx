// Local demo dataset for the F1 InsightX concept build.
// Mirrors the shape of the real pipeline output (season_state.json + CSV snapshots)
// so the UI can be swapped onto live data without layout changes.

export const seasonState = {
  season: 2026,
  resultsThrough: { round: 12, name: "Dutch Grand Prix", date: "2026-08-23" },
  raceWeekRound: 13,
  snapshotISO: "2026-08-24T18:50:28Z",
  pipelineRunISO: "2026-08-24T18:50:28Z",
};

export const nextRace = {
  round: 13,
  totalRounds: 24,
  name: "Italian Grand Prix",
  shortName: "Italian GP",
  circuit: "Autodromo Nazionale Monza",
  country: "Italy",
  timeZone: "Europe/Rome",
  raceStartISO: "2026-09-06T13:00:00Z",
  laps: 53,
  lapKm: 5.793,
  // 2026 regulations: DRS is gone — active aero (X/Z mode) plus manual
  // override energy boost zones replace it.
  overrideZones: 2,
  activeAero: true,
  conditions: {
    rainRiskPct: 0,
    airTempC: 25,
    trackTempC: 37,
    windKph: 12,
    windDir: "S",
  },
  pitWindow: "L20-L27",
  sessions: [
    { code: "FP1", label: "Practice 1", startISO: "2026-09-04T11:30:00Z", status: "scheduled" },
    { code: "FP2", label: "Practice 2", startISO: "2026-09-04T15:00:00Z", status: "scheduled" },
    { code: "FP3", label: "Practice 3", startISO: "2026-09-05T10:30:00Z", status: "scheduled" },
    { code: "Q", label: "Qualifying", startISO: "2026-09-05T14:00:00Z", status: "scheduled" },
    { code: "R", label: "Race", startISO: "2026-09-06T13:00:00Z", status: "scheduled" },
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
  { pos: 1, team: "mercedes" as TeamKey, points: 425, wins: 8, form: [1, 1, 1, 1, 1] },
  { pos: 2, team: "ferrari" as TeamKey, points: 338, wins: 2, form: [2, 2, 2, 2, 2] },
  { pos: 3, team: "mclaren" as TeamKey, points: 263, wins: 2, form: [3, 3, 3, 3, 3] },
  { pos: 4, team: "red-bull" as TeamKey, points: 186, wins: 0, form: [4, 4, 4, 4, 4] },
  { pos: 5, team: "racing-bulls" as TeamKey, points: 66, wins: 0, form: [5, 5, 5, 5, 5] },
  { pos: 6, team: "alpine" as TeamKey, points: 63, wins: 0, form: [6, 6, 6, 6, 6] },
  { pos: 7, team: "haas" as TeamKey, points: 21, wins: 0, form: [7, 7, 7, 7, 7] },
  { pos: 8, team: "sauber" as TeamKey, points: 16, wins: 0, form: [8, 8, 8, 8, 8] },
  { pos: 9, team: "williams" as TeamKey, points: 11, wins: 0, form: [9, 9, 9, 9, 9] },
  { pos: 10, team: "aston-martin" as TeamKey, points: 3, wins: 0, form: [10, 10, 10, 10, 10] },
];

export const driverStandings = [
  { pos: 1, code: "ANT", name: "Kimi Antonelli", team: "mercedes" as TeamKey, points: 242, wins: 6 },
  { pos: 2, code: "RUS", name: "George Russell", team: "mercedes" as TeamKey, points: 183, wins: 2 },
  { pos: 3, code: "HAM", name: "Lewis Hamilton", team: "ferrari" as TeamKey, points: 183, wins: 1 },
  { pos: 4, code: "NOR", name: "Lando Norris", team: "mclaren" as TeamKey, points: 159, wins: 2 },
  { pos: 5, code: "LEC", name: "Charles Leclerc", team: "ferrari" as TeamKey, points: 155, wins: 1 },
  { pos: 6, code: "VER", name: "Max Verstappen", team: "red-bull" as TeamKey, points: 112, wins: 0 },
  { pos: 7, code: "PIA", name: "Oscar Piastri", team: "mclaren" as TeamKey, points: 104, wins: 0 },
  { pos: 8, code: "HAD", name: "Isack Hadjar", team: "red-bull" as TeamKey, points: 68, wins: 0 },
  { pos: 9, code: "LAW", name: "Liam Lawson", team: "red-bull" as TeamKey, points: 49, wins: 0 },
  { pos: 10, code: "GAS", name: "Pierre Gasly", team: "alpine" as TeamKey, points: 44, wins: 0 },
];

export const qualiProjection = [
  { pos: 1, code: "ANT", name: "Kimi Antonelli", team: "mercedes" as TeamKey, lap: "1:11.192", delta: "-", conf: 0.47 },
  { pos: 2, code: "NOR", name: "Lando Norris", team: "mclaren" as TeamKey, lap: "1:11.220", delta: "+0.028", conf: 0.56 },
  { pos: 3, code: "RUS", name: "George Russell", team: "mercedes" as TeamKey, lap: "1:11.290", delta: "+0.098", conf: 0.82 },
  { pos: 4, code: "LEC", name: "Charles Leclerc", team: "ferrari" as TeamKey, lap: "1:11.316", delta: "+0.124", conf: 0.54 },
  { pos: 5, code: "HAM", name: "Lewis Hamilton", team: "ferrari" as TeamKey, lap: "1:11.327", delta: "+0.135", conf: 0.59 },
  { pos: 6, code: "VER", name: "Max Verstappen", team: "red-bull" as TeamKey, lap: "1:11.386", delta: "+0.194", conf: 0.55 },
  { pos: 7, code: "PIA", name: "Oscar Piastri", team: "mclaren" as TeamKey, lap: "1:11.417", delta: "+0.225", conf: 0.46 },
  { pos: 8, code: "HAD", name: "Isack Hadjar", team: "red-bull" as TeamKey, lap: "1:11.670", delta: "+0.478", conf: 0.52 },
  { pos: 9, code: "LIN", name: "Arvid Lindblad", team: "racing-bulls" as TeamKey, lap: "1:12.025", delta: "+0.833", conf: 0.43 },
  { pos: 10, code: "LAW", name: "Liam Lawson", team: "racing-bulls" as TeamKey, lap: "1:12.201", delta: "+1.009", conf: 0.43 },
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
