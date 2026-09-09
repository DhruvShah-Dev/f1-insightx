// Generated local data snapshot for the F1 InsightX root UI.
// Source: data/curated, data/race_analysis, data/race_week, data/season_state.json.

export const seasonState = {
  season: 2026,
  resultsThrough: { round: 13, name: "Italian Grand Prix", date: "2026-09-06" },
  raceWeekRound: 14,
  snapshotISO: "2026-09-08T17:23:24Z",
  pipelineRunISO: "2026-09-08T17:23:24Z",
};

export const nextRace = {
  round: 14,
  totalRounds: 23,
  name: "Spanish Grand Prix",
  shortName: "Spanish GP",
  circuit: "Madring",
  country: "Spain",
  timeZone: "Europe/Madrid",
  raceStartISO: "2026-09-13T13:00:00Z",
  laps: 57,
  lapKm: 0,
  overrideZones: 2,
  activeAero: true,
  conditions: {
    rainRiskPct: 0,
    airTempC: 24,
    trackTempC: 34,
    windKph: 13,
    windDir: "TBC",
  },
  pitWindow: "L22-L32",
  sessions: [
    { code: "FP1", label: "Practice 1", startISO: "2026-09-11T11:30:00Z", status: "scheduled" },
    { code: "FP2", label: "Practice 2", startISO: "2026-09-11T15:00:00Z", status: "scheduled" },
    { code: "FP3", label: "Practice 3", startISO: "2026-09-12T10:30:00Z", status: "scheduled" },
    { code: "Q", label: "Qualifying", startISO: "2026-09-12T14:00:00Z", status: "scheduled" },
    { code: "R", label: "Race", startISO: "2026-09-13T13:00:00Z", status: "scheduled" },
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
  | "audi"
  | "haas"
  | "cadillac";

export const teams: Record<TeamKey, { name: string; short: string; color: string }> = {
  mercedes: { name: "Mercedes", short: "MER", color: "#00d7b6" },
  ferrari: { name: "Ferrari", short: "FER", color: "#e8002d" },
  mclaren: { name: "McLaren", short: "MCL", color: "#ff8000" },
  "red-bull": { name: "Red Bull Racing", short: "RBR", color: "#3671c6" },
  "aston-martin": { name: "Aston Martin", short: "AMR", color: "#00665f" },
  williams: { name: "Williams", short: "WIL", color: "#64c4ff" },
  alpine: { name: "Alpine", short: "ALP", color: "#ff87bc" },
  "racing-bulls": { name: "Racing Bulls", short: "RB", color: "#6692ff" },
  audi: { name: "Audi", short: "AUD", color: "#52e252" },
  haas: { name: "Haas", short: "HAA", color: "#b6babd" },
  cadillac: { name: "Cadillac", short: "CAD", color: "#c5a46d" },
};

export const constructorStandings = [
  { pos: 1, team: "mercedes" as TeamKey, points: 468, wins: 9, form: [1, 1, 1, 1, 1] },
  { pos: 2, team: "ferrari" as TeamKey, points: 346, wins: 2, form: [2, 2, 2, 2, 2] },
  { pos: 3, team: "mclaren" as TeamKey, points: 287, wins: 2, form: [3, 3, 3, 3, 3] },
  { pos: 4, team: "red-bull" as TeamKey, points: 204, wins: 0, form: [4, 4, 4, 4, 4] },
  { pos: 5, team: "racing-bulls" as TeamKey, points: 75, wins: 0, form: [5, 5, 5, 5, 5] },
  { pos: 6, team: "alpine" as TeamKey, points: 62, wins: 0, form: [6, 6, 6, 6, 6] },
  { pos: 7, team: "haas" as TeamKey, points: 21, wins: 0, form: [7, 7, 7, 7, 7] },
  { pos: 8, team: "audi" as TeamKey, points: 16, wins: 0, form: [8, 8, 8, 8, 8] },
  { pos: 9, team: "williams" as TeamKey, points: 11, wins: 0, form: [9, 9, 9, 9, 9] },
  { pos: 10, team: "aston-martin" as TeamKey, points: 3, wins: 0, form: [10, 10, 10, 10, 10] },
  { pos: 11, team: "cadillac" as TeamKey, points: 0, wins: 0, form: [11, 11, 11, 11, 11] },
];

export const driverStandings = [
  {
    pos: 1,
    code: "ANT",
    name: "Kimi Antonelli",
    team: "mercedes" as TeamKey,
    points: 267,
    wins: 7,
  },
  {
    pos: 2,
    code: "RUS",
    name: "George Russell",
    team: "mercedes" as TeamKey,
    points: 201,
    wins: 2,
  },
  { pos: 3, code: "HAM", name: "Lewis Hamilton", team: "ferrari" as TeamKey, points: 191, wins: 1 },
  { pos: 4, code: "NOR", name: "Lando Norris", team: "mclaren" as TeamKey, points: 171, wins: 2 },
  {
    pos: 5,
    code: "LEC",
    name: "Charles Leclerc",
    team: "ferrari" as TeamKey,
    points: 155,
    wins: 1,
  },
  {
    pos: 6,
    code: "VER",
    name: "Max Verstappen",
    team: "red-bull" as TeamKey,
    points: 127,
    wins: 0,
  },
  { pos: 7, code: "PIA", name: "Oscar Piastri", team: "mclaren" as TeamKey, points: 116, wins: 0 },
  { pos: 8, code: "HAD", name: "Isack Hadjar", team: "red-bull" as TeamKey, points: 71, wins: 0 },
  { pos: 9, code: "LAW", name: "Liam Lawson", team: "red-bull" as TeamKey, points: 51, wins: 0 },
  { pos: 10, code: "GAS", name: "Pierre Gasly", team: "alpine" as TeamKey, points: 41, wins: 0 },
  {
    pos: 11,
    code: "LIN",
    name: "Arvid Lindblad",
    team: "racing-bulls" as TeamKey,
    points: 29,
    wins: 0,
  },
  {
    pos: 12,
    code: "COL",
    name: "Franco Colapinto",
    team: "alpine" as TeamKey,
    points: 21,
    wins: 0,
  },
  { pos: 13, code: "BEA", name: "Oliver Bearman", team: "haas" as TeamKey, points: 18, wins: 0 },
  { pos: 14, code: "BOR", name: "Gabriel Bortoleto", team: "audi" as TeamKey, points: 10, wins: 0 },
  { pos: 15, code: "HUL", name: "Nico Hulkenberg", team: "audi" as TeamKey, points: 6, wins: 0 },
  { pos: 16, code: "SAI", name: "Carlos Sainz", team: "williams" as TeamKey, points: 6, wins: 0 },
  { pos: 17, code: "ALB", name: "Alex Albon", team: "williams" as TeamKey, points: 5, wins: 0 },
  {
    pos: 18,
    code: "ALO",
    name: "Fernando Alonso",
    team: "aston-martin" as TeamKey,
    points: 3,
    wins: 0,
  },
  { pos: 19, code: "OCO", name: "Esteban Ocon", team: "haas" as TeamKey, points: 3, wins: 0 },
  { pos: 20, code: "TSU", name: "Tsunoda", team: "racing-bulls" as TeamKey, points: 1, wins: 0 },
  {
    pos: 21,
    code: "BOT",
    name: "Valtteri Bottas",
    team: "cadillac" as TeamKey,
    points: 0,
    wins: 0,
  },
  { pos: 22, code: "PER", name: "Sergio Perez", team: "cadillac" as TeamKey, points: 0, wins: 0 },
  {
    pos: 23,
    code: "STR",
    name: "Lance Stroll",
    team: "aston-martin" as TeamKey,
    points: 0,
    wins: 0,
  },
];

export const qualiProjection = [
  {
    pos: 1,
    code: "ANT",
    name: "Kimi Antonelli",
    team: "mercedes" as TeamKey,
    lap: "1:12.194",
    delta: "+0.194",
    conf: 0.68,
  },
  {
    pos: 2,
    code: "RUS",
    name: "George Russell",
    team: "mercedes" as TeamKey,
    lap: "1:12.258",
    delta: "+0.258",
    conf: 0.68,
  },
  {
    pos: 3,
    code: "HAM",
    name: "Lewis Hamilton",
    team: "ferrari" as TeamKey,
    lap: "1:12.322",
    delta: "+0.322",
    conf: 0.68,
  },
  {
    pos: 4,
    code: "NOR",
    name: "Lando Norris",
    team: "mclaren" as TeamKey,
    lap: "1:12.343",
    delta: "+0.343",
    conf: 0.68,
  },
  {
    pos: 5,
    code: "LEC",
    name: "Charles Leclerc",
    team: "ferrari" as TeamKey,
    lap: "1:12.400",
    delta: "+0.400",
    conf: 0.68,
  },
  {
    pos: 6,
    code: "PIA",
    name: "Oscar Piastri",
    team: "mclaren" as TeamKey,
    lap: "1:12.445",
    delta: "+0.445",
    conf: 0.68,
  },
  {
    pos: 7,
    code: "VER",
    name: "Max Verstappen",
    team: "red-bull" as TeamKey,
    lap: "1:12.660",
    delta: "+0.660",
    conf: 0.68,
  },
  {
    pos: 8,
    code: "LAW",
    name: "Liam Lawson",
    team: "red-bull" as TeamKey,
    lap: "1:12.850",
    delta: "+0.850",
    conf: 0.68,
  },
  {
    pos: 9,
    code: "LIN",
    name: "Arvid Lindblad",
    team: "racing-bulls" as TeamKey,
    lap: "1:13.170",
    delta: "+1.170",
    conf: 0.68,
  },
  {
    pos: 10,
    code: "GAS",
    name: "Pierre Gasly",
    team: "alpine" as TeamKey,
    lap: "1:13.308",
    delta: "+1.308",
    conf: 0.68,
  },
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
    round: 13,
    slug: "2026-13-monza",
    name: "Italian Grand Prix",
    circuit: "Autodromo Nazionale di Monza",
    dateISO: "2026-09-06T13:00:00Z",
    winner: { code: "ANT", name: "Kimi Antonelli", team: "mercedes" },
    margin: "",
    strategy: "one-stop majority",
    lede: "ANT won for Mercedes.",
    keyReads: [
      {
        label: "Pace factor",
        value: "ANT held the strongest",
        note: "ANT held the strongest median race pace.",
      },
      {
        label: "Strategy factor",
        value: "one-stop majority",
        note: "one-stop majority shaped stint length and tyre exposure.",
      },
      {
        label: "Position factor",
        value: "Position swing",
        note: "ANT had the largest start-finish gain proxy.",
      },
    ],
    stints: [
      { code: "ANT", team: "mercedes" as TeamKey, plan: "HARD > MEDIUM > MEDIUM" },
      { code: "RUS", team: "mercedes" as TeamKey, plan: "HARD > MEDIUM > MEDIUM" },
      { code: "VER", team: "red-bull" as TeamKey, plan: "HARD > MEDIUM > MEDIUM" },
    ],
  },
  {
    round: 12,
    slug: "2026-12-zandvoort",
    name: "Dutch Grand Prix",
    circuit: "Circuit Park Zandvoort",
    dateISO: "2026-08-23T13:00:00Z",
    winner: { code: "NOR", name: "Lando Norris", team: "mclaren" },
    margin: "",
    strategy: "3-stop majority",
    lede: "NOR won for McLaren.",
    keyReads: [
      {
        label: "Pace factor",
        value: "ANT held the strongest",
        note: "ANT held the strongest median race pace.",
      },
      {
        label: "Strategy factor",
        value: "3-stop majority",
        note: "3-stop majority shaped stint length and tyre exposure.",
      },
      {
        label: "Position factor",
        value: "Position swing",
        note: "ALO had the largest start-finish gain proxy.",
      },
    ],
    stints: [
      { code: "NOR", team: "mclaren" as TeamKey, plan: "MEDIUM > SOFT > HARD > HARD" },
      { code: "ANT", team: "mercedes" as TeamKey, plan: "MEDIUM > SOFT > HARD > HARD" },
      { code: "RUS", team: "mercedes" as TeamKey, plan: "MEDIUM > SOFT > HARD > HARD" },
    ],
  },
  {
    round: 11,
    slug: "2026-11-hungaroring",
    name: "Hungarian Grand Prix",
    circuit: "Hungaroring",
    dateISO: "2026-07-26T13:00:00Z",
    winner: { code: "NOR", name: "Lando Norris", team: "mclaren" },
    margin: "",
    strategy: "two-stop majority",
    lede: "NOR won for McLaren.",
    keyReads: [
      {
        label: "Pace factor",
        value: "NOR held the strongest",
        note: "NOR held the strongest median race pace.",
      },
      {
        label: "Strategy factor",
        value: "two-stop majority",
        note: "two-stop majority shaped stint length and tyre exposure.",
      },
      {
        label: "Position factor",
        value: "Position swing",
        note: "STR had the largest start-finish gain proxy.",
      },
    ],
    stints: [
      { code: "NOR", team: "mclaren" as TeamKey, plan: "MEDIUM > HARD > HARD > SOFT" },
      { code: "VER", team: "red-bull" as TeamKey, plan: "MEDIUM > HARD > HARD > SOFT" },
      { code: "ANT", team: "mercedes" as TeamKey, plan: "MEDIUM > HARD > HARD > SOFT" },
    ],
  },
  {
    round: 10,
    slug: "2026-10-spa",
    name: "Belgian Grand Prix",
    circuit: "Circuit de Spa-Francorchamps",
    dateISO: "2026-07-19T13:00:00Z",
    winner: { code: "ANT", name: "Kimi Antonelli", team: "mercedes" },
    margin: "",
    strategy: "one-stop majority",
    lede: "ANT won for Mercedes.",
    keyReads: [
      {
        label: "Pace factor",
        value: "ANT held the strongest",
        note: "ANT held the strongest median race pace.",
      },
      {
        label: "Strategy factor",
        value: "one-stop majority",
        note: "one-stop majority shaped stint length and tyre exposure.",
      },
      {
        label: "Position factor",
        value: "Position swing",
        note: "HAD had the largest start-finish gain proxy.",
      },
    ],
    stints: [
      { code: "ANT", team: "mercedes" as TeamKey, plan: "MEDIUM > SOFT" },
      { code: "LEC", team: "ferrari" as TeamKey, plan: "MEDIUM > SOFT" },
      { code: "VER", team: "red-bull" as TeamKey, plan: "MEDIUM > SOFT" },
    ],
  },
  {
    round: 9,
    slug: "2026-09-silverstone",
    name: "British Grand Prix",
    circuit: "Silverstone Circuit",
    dateISO: "2026-07-05T14:00:00Z",
    winner: { code: "LEC", name: "Charles Leclerc", team: "ferrari" },
    margin: "",
    strategy: "two-stop majority",
    lede: "LEC won for Ferrari.",
    keyReads: [
      {
        label: "Pace factor",
        value: "LEC held the strongest",
        note: "LEC held the strongest median race pace.",
      },
      {
        label: "Strategy factor",
        value: "two-stop majority",
        note: "two-stop majority shaped stint length and tyre exposure.",
      },
      {
        label: "Position factor",
        value: "Position swing",
        note: "COL had the largest start-finish gain proxy.",
      },
    ],
    stints: [
      { code: "LEC", team: "ferrari" as TeamKey, plan: "MEDIUM > HARD > SOFT" },
      { code: "RUS", team: "mercedes" as TeamKey, plan: "MEDIUM > HARD > SOFT" },
      { code: "HAM", team: "ferrari" as TeamKey, plan: "MEDIUM > HARD > SOFT" },
    ],
  },
  {
    round: 8,
    slug: "2026-08-red_bull_ring",
    name: "Austrian Grand Prix",
    circuit: "Red Bull Ring",
    dateISO: "2026-06-28T13:00:00Z",
    winner: { code: "RUS", name: "George Russell", team: "mercedes" },
    margin: "",
    strategy: "two-stop majority",
    lede: "RUS won for Mercedes.",
    keyReads: [
      {
        label: "Pace factor",
        value: "ANT held the strongest",
        note: "ANT held the strongest median race pace.",
      },
      {
        label: "Strategy factor",
        value: "two-stop majority",
        note: "two-stop majority shaped stint length and tyre exposure.",
      },
      {
        label: "Position factor",
        value: "Position swing",
        note: "VER had the largest start-finish gain proxy.",
      },
    ],
    stints: [
      { code: "RUS", team: "mercedes" as TeamKey, plan: "MEDIUM > HARD > HARD" },
      { code: "VER", team: "red-bull" as TeamKey, plan: "MEDIUM > HARD > HARD" },
      { code: "ANT", team: "mercedes" as TeamKey, plan: "MEDIUM > HARD > HARD" },
    ],
  },
  {
    round: 7,
    slug: "2026-07-catalunya",
    name: "Barcelona Grand Prix",
    circuit: "Circuit de Barcelona-Catalunya",
    dateISO: "2026-06-14T13:00:00Z",
    winner: { code: "HAM", name: "Lewis Hamilton", team: "ferrari" },
    margin: "",
    strategy: "two-stop majority",
    lede: "HAM won for Ferrari.",
    keyReads: [
      {
        label: "Pace factor",
        value: "HAM held the strongest",
        note: "HAM held the strongest median race pace.",
      },
      {
        label: "Strategy factor",
        value: "two-stop majority",
        note: "two-stop majority shaped stint length and tyre exposure.",
      },
      {
        label: "Position factor",
        value: "Position swing",
        note: "GAS had the largest start-finish gain proxy.",
      },
    ],
    stints: [
      { code: "HAM", team: "ferrari" as TeamKey, plan: "SOFT > HARD > MEDIUM > HARD" },
      { code: "RUS", team: "mercedes" as TeamKey, plan: "SOFT > HARD > MEDIUM > HARD" },
      { code: "NOR", team: "mclaren" as TeamKey, plan: "SOFT > HARD > MEDIUM > HARD" },
    ],
  },
  {
    round: 6,
    slug: "2026-06-monaco",
    name: "Monaco Grand Prix",
    circuit: "Circuit de Monaco",
    dateISO: "2026-06-07T13:00:00Z",
    winner: { code: "ANT", name: "Kimi Antonelli", team: "mercedes" },
    margin: "",
    strategy: "5-stop majority",
    lede: "ANT won for Mercedes.",
    keyReads: [
      {
        label: "Pace factor",
        value: "ANT held the strongest",
        note: "ANT held the strongest median race pace.",
      },
      {
        label: "Strategy factor",
        value: "5-stop majority",
        note: "5-stop majority shaped stint length and tyre exposure.",
      },
      {
        label: "Position factor",
        value: "Position swing",
        note: "ALO had the largest start-finish gain proxy.",
      },
    ],
    stints: [
      { code: "ANT", team: "mercedes" as TeamKey, plan: "MEDIUM > HARD > SOFT > SOFT > SOFT" },
      { code: "HAM", team: "ferrari" as TeamKey, plan: "MEDIUM > HARD > SOFT > SOFT > SOFT" },
      { code: "GAS", team: "alpine" as TeamKey, plan: "MEDIUM > HARD > SOFT > SOFT > SOFT" },
    ],
  },
  {
    round: 5,
    slug: "2026-05-villeneuve",
    name: "Canadian Grand Prix",
    circuit: "Circuit Gilles Villeneuve",
    dateISO: "2026-05-24T20:00:00Z",
    winner: { code: "ANT", name: "Kimi Antonelli", team: "mercedes" },
    margin: "",
    strategy: "one-stop majority",
    lede: "ANT won for Mercedes.",
    keyReads: [
      {
        label: "Pace factor",
        value: "ANT held the strongest",
        note: "ANT held the strongest median race pace.",
      },
      {
        label: "Strategy factor",
        value: "one-stop majority",
        note: "one-stop majority shaped stint length and tyre exposure.",
      },
      {
        label: "Position factor",
        value: "Position swing",
        note: "STR had the largest start-finish gain proxy.",
      },
    ],
    stints: [
      { code: "ANT", team: "mercedes" as TeamKey, plan: "SOFT > MEDIUM" },
      { code: "HAM", team: "ferrari" as TeamKey, plan: "SOFT > MEDIUM" },
      { code: "VER", team: "red-bull" as TeamKey, plan: "SOFT > MEDIUM" },
    ],
  },
  {
    round: 4,
    slug: "2026-04-miami",
    name: "Miami Grand Prix",
    circuit: "Miami International Autodrome",
    dateISO: "2026-05-03T20:00:00Z",
    winner: { code: "ANT", name: "Kimi Antonelli", team: "mercedes" },
    margin: "",
    strategy: "one-stop majority",
    lede: "ANT won for Mercedes.",
    keyReads: [
      {
        label: "Pace factor",
        value: "NOR held the strongest",
        note: "NOR held the strongest median race pace.",
      },
      {
        label: "Strategy factor",
        value: "one-stop majority",
        note: "one-stop majority shaped stint length and tyre exposure.",
      },
      {
        label: "Position factor",
        value: "Position swing",
        note: "BOR had the largest start-finish gain proxy.",
      },
    ],
    stints: [
      { code: "ANT", team: "mercedes" as TeamKey, plan: "MEDIUM > HARD" },
      { code: "NOR", team: "mclaren" as TeamKey, plan: "MEDIUM > HARD" },
      { code: "PIA", team: "mclaren" as TeamKey, plan: "MEDIUM > HARD" },
    ],
  },
  {
    round: 3,
    slug: "2026-03-suzuka",
    name: "Japanese Grand Prix",
    circuit: "Suzuka Circuit",
    dateISO: "2026-03-29T05:00:00Z",
    winner: { code: "ANT", name: "Kimi Antonelli", team: "mercedes" },
    margin: "",
    strategy: "one-stop majority",
    lede: "ANT won for Mercedes.",
    keyReads: [
      {
        label: "Pace factor",
        value: "ANT held the strongest",
        note: "ANT held the strongest median race pace.",
      },
      {
        label: "Strategy factor",
        value: "one-stop majority",
        note: "one-stop majority shaped stint length and tyre exposure.",
      },
      {
        label: "Position factor",
        value: "Position swing",
        note: "LAW had the largest start-finish gain proxy.",
      },
    ],
    stints: [
      { code: "ANT", team: "mercedes" as TeamKey, plan: "MEDIUM > HARD" },
      { code: "PIA", team: "mclaren" as TeamKey, plan: "MEDIUM > HARD" },
      { code: "LEC", team: "ferrari" as TeamKey, plan: "MEDIUM > HARD" },
    ],
  },
  {
    round: 2,
    slug: "2026-02-shanghai",
    name: "Chinese Grand Prix",
    circuit: "Shanghai International Circuit",
    dateISO: "2026-03-15T07:00:00Z",
    winner: { code: "ANT", name: "Kimi Antonelli", team: "mercedes" },
    margin: "",
    strategy: "one-stop majority",
    lede: "ANT won for Mercedes.",
    keyReads: [
      {
        label: "Pace factor",
        value: "RUS held the strongest",
        note: "RUS held the strongest median race pace.",
      },
      {
        label: "Strategy factor",
        value: "one-stop majority",
        note: "one-stop majority shaped stint length and tyre exposure.",
      },
      {
        label: "Position factor",
        value: "Position swing",
        note: "SAI had the largest start-finish gain proxy.",
      },
    ],
    stints: [
      { code: "ANT", team: "mercedes" as TeamKey, plan: "MEDIUM > HARD" },
      { code: "RUS", team: "mercedes" as TeamKey, plan: "MEDIUM > HARD" },
      { code: "HAM", team: "ferrari" as TeamKey, plan: "MEDIUM > HARD" },
    ],
  },
  {
    round: 1,
    slug: "2026-01-albert_park",
    name: "Australian Grand Prix",
    circuit: "Albert Park Grand Prix Circuit",
    dateISO: "2026-03-08T04:00:00Z",
    winner: { code: "RUS", name: "George Russell", team: "mercedes" },
    margin: "",
    strategy: "one-stop majority",
    lede: "RUS won for Mercedes.",
    keyReads: [
      {
        label: "Pace factor",
        value: "ANT held the strongest",
        note: "ANT held the strongest median race pace.",
      },
      {
        label: "Strategy factor",
        value: "one-stop majority",
        note: "one-stop majority shaped stint length and tyre exposure.",
      },
      {
        label: "Position factor",
        value: "Position swing",
        note: "VER had the largest start-finish gain proxy.",
      },
    ],
    stints: [
      { code: "RUS", team: "mercedes" as TeamKey, plan: "MEDIUM > HARD" },
      { code: "ANT", team: "mercedes" as TeamKey, plan: "MEDIUM > HARD" },
      { code: "LEC", team: "ferrari" as TeamKey, plan: "MEDIUM > HARD" },
    ],
  },
];
