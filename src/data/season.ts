// Generated local data snapshot for the F1 InsightX root UI.
// Source: data/curated, data/race_analysis, data/race_week, data/season_state.json.

export const seasonState = {
  season: 2026,
  resultsThrough: { round: 14, name: "Spanish Grand Prix", date: "2026-09-13" },
  raceWeekRound: 15,
  snapshotISO: "2026-09-15T19:01:22Z",
  pipelineRunISO: "2026-09-15T19:01:22Z",
};

export const nextRace = {
  round: 15,
  totalRounds: 23,
  name: "Azerbaijan Grand Prix",
  shortName: "Azerbaijan GP",
  circuit: "Baku City Circuit",
  country: "Azerbaijan",
  timeZone: "Asia/Baku",
  raceStartISO: "2026-09-26T11:00:00Z",
  laps: 51,
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
  pitWindow: "L16-L24",
  sessions: [
    { code: "FP1", label: "Practice 1", startISO: "2026-09-24T08:30:00Z", status: "scheduled" },
    { code: "FP2", label: "Practice 2", startISO: "2026-09-24T12:00:00Z", status: "scheduled" },
    { code: "FP3", label: "Practice 3", startISO: "2026-09-25T08:30:00Z", status: "scheduled" },
    { code: "Q", label: "Qualifying", startISO: "2026-09-25T12:00:00Z", status: "scheduled" },
    { code: "R", label: "Race", startISO: "2026-09-26T11:00:00Z", status: "scheduled" },
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
  { pos: 1, team: "mercedes" as TeamKey, points: 503, wins: 10, form: [1] },
  { pos: 2, team: "ferrari" as TeamKey, points: 358, wins: 2, form: [2] },
  { pos: 3, team: "mclaren" as TeamKey, points: 306, wins: 2, form: [3] },
  { pos: 4, team: "red-bull" as TeamKey, points: 230, wins: 0, form: [4] },
  { pos: 5, team: "racing-bulls" as TeamKey, points: 77, wins: 0, form: [5] },
  { pos: 6, team: "alpine" as TeamKey, points: 68, wins: 0, form: [6] },
  { pos: 7, team: "haas" as TeamKey, points: 21, wins: 0, form: [7] },
  { pos: 8, team: "audi" as TeamKey, points: 17, wins: 0, form: [8] },
  { pos: 9, team: "williams" as TeamKey, points: 11, wins: 0, form: [9] },
  { pos: 10, team: "aston-martin" as TeamKey, points: 3, wins: 0, form: [10] },
  { pos: 11, team: "cadillac" as TeamKey, points: 0, wins: 0, form: [11] },
];

export const driverStandings = [
  {
    pos: 1,
    code: "ANT",
    name: "Andrea Kimi Antonelli",
    team: "mercedes" as TeamKey,
    points: 292,
    wins: 8,
  },
  {
    pos: 2,
    code: "RUS",
    name: "Russell",
    team: "mercedes" as TeamKey,
    points: 211,
    wins: 2,
  },
  {
    pos: 3,
    code: "HAM",
    name: "Hamilton",
    team: "ferrari" as TeamKey,
    points: 191,
    wins: 1,
  },
  {
    pos: 4,
    code: "NOR",
    name: "Norris",
    team: "mclaren" as TeamKey,
    points: 186,
    wins: 2,
  },
  {
    pos: 5,
    code: "LEC",
    name: "Leclerc",
    team: "ferrari" as TeamKey,
    points: 167,
    wins: 1,
  },
  {
    pos: 6,
    code: "MAX",
    name: "Max Verstappen",
    team: "red-bull" as TeamKey,
    points: 145,
    wins: 0,
  },
  {
    pos: 7,
    code: "PIA",
    name: "Piastri",
    team: "mclaren" as TeamKey,
    points: 120,
    wins: 0,
  },
  {
    pos: 8,
    code: "HAD",
    name: "Hadjar",
    team: "red-bull" as TeamKey,
    points: 71,
    wins: 0,
  },
  {
    pos: 9,
    code: "LAW",
    name: "Lawson",
    team: "red-bull" as TeamKey,
    points: 59,
    wins: 0,
  },
  {
    pos: 10,
    code: "GAS",
    name: "Gasly",
    team: "alpine" as TeamKey,
    points: 41,
    wins: 0,
  },
  {
    pos: 11,
    code: "ARV",
    name: "Arvid Lindblad",
    team: "racing-bulls" as TeamKey,
    points: 31,
    wins: 0,
  },
  {
    pos: 12,
    code: "COL",
    name: "Colapinto",
    team: "alpine" as TeamKey,
    points: 27,
    wins: 0,
  },
  {
    pos: 13,
    code: "BEA",
    name: "Oliver Bearman",
    team: "haas" as TeamKey,
    points: 18,
    wins: 0,
  },
  {
    pos: 14,
    code: "BOR",
    name: "Gabriel Bortoleto",
    team: "audi" as TeamKey,
    points: 10,
    wins: 0,
  },
  {
    pos: 15,
    code: "HUL",
    name: "Hulkenberg",
    team: "audi" as TeamKey,
    points: 7,
    wins: 0,
  },
  {
    pos: 16,
    code: "SAI",
    name: "Sainz",
    team: "williams" as TeamKey,
    points: 6,
    wins: 0,
  },
  {
    pos: 17,
    code: "ALB",
    name: "Alexander Albon",
    team: "williams" as TeamKey,
    points: 5,
    wins: 0,
  },
  {
    pos: 18,
    code: "ALO",
    name: "Fernando Alonso",
    team: "aston-martin" as TeamKey,
    points: 3,
    wins: 0,
  },
  {
    pos: 19,
    code: "OCO",
    name: "Ocon",
    team: "haas" as TeamKey,
    points: 3,
    wins: 0,
  },
  {
    pos: 20,
    code: "TSU",
    name: "Tsunoda",
    team: "racing-bulls" as TeamKey,
    points: 1,
    wins: 0,
  },
  {
    pos: 21,
    code: "BOT",
    name: "Bottas",
    team: "cadillac" as TeamKey,
    points: 0,
    wins: 0,
  },
  {
    pos: 22,
    code: "PER",
    name: "Perez",
    team: "cadillac" as TeamKey,
    points: 0,
    wins: 0,
  },
  {
    pos: 23,
    code: "STR",
    name: "Stroll",
    team: "aston-martin" as TeamKey,
    points: 0,
    wins: 0,
  },
];

export const qualiProjection = [
  {
    pos: 1,
    code: "ANT",
    name: "Andrea Kimi Antonelli",
    team: "mercedes" as TeamKey,
    lap: "1:12.155",
    delta: "+0.155",
    conf: 0.68,
  },
  {
    pos: 2,
    code: "RUS",
    name: "Russell",
    team: "mercedes" as TeamKey,
    lap: "1:12.235",
    delta: "+0.235",
    conf: 0.68,
  },
  {
    pos: 3,
    code: "NOR",
    name: "Norris",
    team: "mclaren" as TeamKey,
    lap: "1:12.341",
    delta: "+0.341",
    conf: 0.68,
  },
  {
    pos: 4,
    code: "LEC",
    name: "Leclerc",
    team: "ferrari" as TeamKey,
    lap: "1:12.397",
    delta: "+0.397",
    conf: 0.68,
  },
  {
    pos: 5,
    code: "HAM",
    name: "Hamilton",
    team: "ferrari" as TeamKey,
    lap: "1:12.429",
    delta: "+0.429",
    conf: 0.68,
  },
  {
    pos: 6,
    code: "PIA",
    name: "Piastri",
    team: "mclaren" as TeamKey,
    lap: "1:12.441",
    delta: "+0.441",
    conf: 0.68,
  },
  {
    pos: 7,
    code: "MAX",
    name: "Max Verstappen",
    team: "red-bull" as TeamKey,
    lap: "1:12.539",
    delta: "+0.539",
    conf: 0.68,
  },
  {
    pos: 8,
    code: "LAW",
    name: "Lawson",
    team: "red-bull" as TeamKey,
    lap: "1:12.706",
    delta: "+0.706",
    conf: 0.68,
  },
  {
    pos: 9,
    code: "ARV",
    name: "Arvid Lindblad",
    team: "racing-bulls" as TeamKey,
    lap: "1:13.209",
    delta: "+1.209",
    conf: 0.68,
  },
  {
    pos: 10,
    code: "COL",
    name: "Colapinto",
    team: "alpine" as TeamKey,
    lap: "1:13.336",
    delta: "+1.336",
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
    round: 14,
    slug: "2026-14-madring",
    name: "Spanish Grand Prix",
    circuit: "Madring",
    dateISO: "2026-09-13T13:00:00Z",
    winner: { code: "ANT", name: "Andrea Kimi Antonelli", team: "mercedes" },
    margin: "",
    strategy: "one-stop majority",
    lede: "ANT won for Mercedes.",
    keyReads: [
      {
        label: "Pace factor",
        value: "NOR held the strongest median race pace",
        note: "NOR held the strongest median race pace.",
      },
      {
        label: "Strategy factor",
        value: "one-stop majority shaped stint length and tyre exposure",
        note: "one-stop majority shaped stint length and tyre exposure.",
      },
      {
        label: "Position factor",
        value: "BEA had the largest start-finish gain proxy",
        note: "BEA had the largest start-finish gain proxy.",
      },
    ],
    stints: [
      { code: "ANT", team: "mercedes" as TeamKey, plan: "MEDIUM > HARD" },
      { code: "VER", team: "red-bull" as TeamKey, plan: "SOFT > HARD" },
      { code: "NOR", team: "mclaren" as TeamKey, plan: "MEDIUM > HARD" },
    ],
  },
  {
    round: 13,
    slug: "2026-13-monza",
    name: "Italian Grand Prix",
    circuit: "Autodromo Nazionale di Monza",
    dateISO: "2026-09-06T13:00:00Z",
    winner: { code: "ANT", name: "Andrea Kimi Antonelli", team: "mercedes" },
    margin: "",
    strategy: "one-stop majority",
    lede: "ANT won for Mercedes.",
    keyReads: [
      {
        label: "Pace factor",
        value: "ANT held the strongest median race pace",
        note: "ANT held the strongest median race pace.",
      },
      {
        label: "Strategy factor",
        value: "one-stop majority shaped stint length and tyre exposure",
        note: "one-stop majority shaped stint length and tyre exposure.",
      },
      {
        label: "Position factor",
        value: "ANT had the largest start-finish gain proxy",
        note: "ANT had the largest start-finish gain proxy.",
      },
    ],
    stints: [
      { code: "ANT", team: "mercedes" as TeamKey, plan: "HARD > MEDIUM > MEDIUM" },
      { code: "RUS", team: "mercedes" as TeamKey, plan: "MEDIUM > HARD" },
      { code: "VER", team: "red-bull" as TeamKey, plan: "SOFT > MEDIUM > HARD" },
    ],
  },
  {
    round: 12,
    slug: "2026-12-zandvoort",
    name: "Dutch Grand Prix",
    circuit: "Circuit Park Zandvoort",
    dateISO: "2026-08-23T13:00:00Z",
    winner: { code: "NOR", name: "Nor", team: "mclaren" },
    margin: "",
    strategy: "3-stop majority",
    lede: "NOR won for McLaren.",
    keyReads: [
      {
        label: "Pace factor",
        value: "ANT held the strongest median race pace",
        note: "ANT held the strongest median race pace.",
      },
      {
        label: "Strategy factor",
        value: "3-stop majority shaped stint length and tyre exposure",
        note: "3-stop majority shaped stint length and tyre exposure.",
      },
      {
        label: "Position factor",
        value: "ALO had the largest start-finish gain proxy",
        note: "ALO had the largest start-finish gain proxy.",
      },
    ],
    stints: [
      { code: "NOR", team: "mclaren" as TeamKey, plan: "MEDIUM > SOFT > HARD > HARD" },
      { code: "ANT", team: "mercedes" as TeamKey, plan: "MEDIUM > MEDIUM > HARD > HARD > SOFT" },
      { code: "RUS", team: "mercedes" as TeamKey, plan: "MEDIUM > MEDIUM > HARD > HARD" },
    ],
  },
  {
    round: 11,
    slug: "2026-11-hungaroring",
    name: "Hungarian Grand Prix",
    circuit: "Hungaroring",
    dateISO: "2026-07-26T13:00:00Z",
    winner: { code: "NOR", name: "Nor", team: "mclaren" },
    margin: "",
    strategy: "two-stop majority",
    lede: "NOR won for McLaren.",
    keyReads: [
      {
        label: "Pace factor",
        value: "NOR held the strongest median race pace",
        note: "NOR held the strongest median race pace.",
      },
      {
        label: "Strategy factor",
        value: "two-stop majority shaped stint length and tyre exposure",
        note: "two-stop majority shaped stint length and tyre exposure.",
      },
      {
        label: "Position factor",
        value: "STR had the largest start-finish gain proxy",
        note: "STR had the largest start-finish gain proxy.",
      },
    ],
    stints: [
      { code: "NOR", team: "mclaren" as TeamKey, plan: "MEDIUM > HARD > HARD > SOFT" },
      { code: "VER", team: "red-bull" as TeamKey, plan: "MEDIUM > HARD > SOFT" },
      { code: "ANT", team: "mercedes" as TeamKey, plan: "MEDIUM > HARD > HARD" },
    ],
  },
  {
    round: 10,
    slug: "2026-10-spa",
    name: "Belgian Grand Prix",
    circuit: "Circuit de Spa-Francorchamps",
    dateISO: "2026-07-19T13:00:00Z",
    winner: { code: "ANT", name: "Andrea Kimi Antonelli", team: "mercedes" },
    margin: "",
    strategy: "one-stop majority",
    lede: "ANT won for Mercedes.",
    keyReads: [
      {
        label: "Pace factor",
        value: "ANT held the strongest median race pace",
        note: "ANT held the strongest median race pace.",
      },
      {
        label: "Strategy factor",
        value: "one-stop majority shaped stint length and tyre exposure",
        note: "one-stop majority shaped stint length and tyre exposure.",
      },
      {
        label: "Position factor",
        value: "HAD had the largest start-finish gain proxy",
        note: "HAD had the largest start-finish gain proxy.",
      },
    ],
    stints: [
      { code: "ANT", team: "mercedes" as TeamKey, plan: "MEDIUM > SOFT" },
      { code: "LEC", team: "ferrari" as TeamKey, plan: "MEDIUM > HARD" },
      { code: "VER", team: "red-bull" as TeamKey, plan: "MEDIUM > HARD" },
    ],
  },
  {
    round: 9,
    slug: "2026-09-silverstone",
    name: "British Grand Prix",
    circuit: "Silverstone Circuit",
    dateISO: "2026-07-05T14:00:00Z",
    winner: { code: "LEC", name: "Lec", team: "ferrari" },
    margin: "",
    strategy: "two-stop majority",
    lede: "LEC won for Ferrari.",
    keyReads: [
      {
        label: "Pace factor",
        value: "LEC held the strongest median race pace",
        note: "LEC held the strongest median race pace.",
      },
      {
        label: "Strategy factor",
        value: "two-stop majority shaped stint length and tyre exposure",
        note: "two-stop majority shaped stint length and tyre exposure.",
      },
      {
        label: "Position factor",
        value: "COL had the largest start-finish gain proxy",
        note: "COL had the largest start-finish gain proxy.",
      },
    ],
    stints: [
      { code: "LEC", team: "ferrari" as TeamKey, plan: "MEDIUM > HARD > SOFT" },
      { code: "RUS", team: "mercedes" as TeamKey, plan: "MEDIUM > HARD > MEDIUM" },
      { code: "HAM", team: "ferrari" as TeamKey, plan: "MEDIUM > HARD > SOFT" },
    ],
  },
  {
    round: 8,
    slug: "2026-08-red_bull_ring",
    name: "Austrian Grand Prix",
    circuit: "Red Bull Ring",
    dateISO: "2026-06-28T13:00:00Z",
    winner: { code: "RUS", name: "Rus", team: "mercedes" },
    margin: "",
    strategy: "two-stop majority",
    lede: "RUS won for Mercedes.",
    keyReads: [
      {
        label: "Pace factor",
        value: "ANT held the strongest median race pace",
        note: "ANT held the strongest median race pace.",
      },
      {
        label: "Strategy factor",
        value: "two-stop majority shaped stint length and tyre exposure",
        note: "two-stop majority shaped stint length and tyre exposure.",
      },
      {
        label: "Position factor",
        value: "VER had the largest start-finish gain proxy",
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
    winner: { code: "HAM", name: "Ham", team: "ferrari" },
    margin: "",
    strategy: "two-stop majority",
    lede: "HAM won for Ferrari.",
    keyReads: [
      {
        label: "Pace factor",
        value: "HAM held the strongest median race pace",
        note: "HAM held the strongest median race pace.",
      },
      {
        label: "Strategy factor",
        value: "two-stop majority shaped stint length and tyre exposure",
        note: "two-stop majority shaped stint length and tyre exposure.",
      },
      {
        label: "Position factor",
        value: "GAS had the largest start-finish gain proxy",
        note: "GAS had the largest start-finish gain proxy.",
      },
    ],
    stints: [
      { code: "HAM", team: "ferrari" as TeamKey, plan: "SOFT > HARD > MEDIUM > HARD" },
      { code: "RUS", team: "mercedes" as TeamKey, plan: "MEDIUM > HARD > HARD" },
      { code: "NOR", team: "mclaren" as TeamKey, plan: "MEDIUM > HARD > HARD" },
    ],
  },
  {
    round: 6,
    slug: "2026-06-monaco",
    name: "Monaco Grand Prix",
    circuit: "Circuit de Monaco",
    dateISO: "2026-06-07T13:00:00Z",
    winner: { code: "ANT", name: "Andrea Kimi Antonelli", team: "mercedes" },
    margin: "",
    strategy: "5-stop majority",
    lede: "ANT won for Mercedes.",
    keyReads: [
      {
        label: "Pace factor",
        value: "ANT held the strongest median race pace",
        note: "ANT held the strongest median race pace.",
      },
      {
        label: "Strategy factor",
        value: "5-stop majority shaped stint length and tyre exposure",
        note: "5-stop majority shaped stint length and tyre exposure.",
      },
      {
        label: "Position factor",
        value: "ALO had the largest start-finish gain proxy",
        note: "ALO had the largest start-finish gain proxy.",
      },
    ],
    stints: [
      { code: "ANT", team: "mercedes" as TeamKey, plan: "MEDIUM > HARD > SOFT > SOFT > SOFT" },
      {
        code: "HAM",
        team: "ferrari" as TeamKey,
        plan: "MEDIUM > HARD > SOFT > SOFT > SOFT > SOFT",
      },
      { code: "GAS", team: "alpine" as TeamKey, plan: "MEDIUM > HARD > HARD > HARD > SOFT" },
    ],
  },
  {
    round: 5,
    slug: "2026-05-villeneuve",
    name: "Canadian Grand Prix",
    circuit: "Circuit Gilles Villeneuve",
    dateISO: "2026-05-24T20:00:00Z",
    winner: { code: "ANT", name: "Andrea Kimi Antonelli", team: "mercedes" },
    margin: "",
    strategy: "one-stop majority",
    lede: "ANT won for Mercedes.",
    keyReads: [
      {
        label: "Pace factor",
        value: "ANT held the strongest median race pace",
        note: "ANT held the strongest median race pace.",
      },
      {
        label: "Strategy factor",
        value: "one-stop majority shaped stint length and tyre exposure",
        note: "one-stop majority shaped stint length and tyre exposure.",
      },
      {
        label: "Position factor",
        value: "STR had the largest start-finish gain proxy",
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
    winner: { code: "ANT", name: "Andrea Kimi Antonelli", team: "mercedes" },
    margin: "",
    strategy: "one-stop majority",
    lede: "ANT won for Mercedes.",
    keyReads: [
      {
        label: "Pace factor",
        value: "NOR held the strongest median race pace",
        note: "NOR held the strongest median race pace.",
      },
      {
        label: "Strategy factor",
        value: "one-stop majority shaped stint length and tyre exposure",
        note: "one-stop majority shaped stint length and tyre exposure.",
      },
      {
        label: "Position factor",
        value: "BOR had the largest start-finish gain proxy",
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
    winner: { code: "ANT", name: "Andrea Kimi Antonelli", team: "mercedes" },
    margin: "",
    strategy: "one-stop majority",
    lede: "ANT won for Mercedes.",
    keyReads: [
      {
        label: "Pace factor",
        value: "ANT held the strongest median race pace",
        note: "ANT held the strongest median race pace.",
      },
      {
        label: "Strategy factor",
        value: "one-stop majority shaped stint length and tyre exposure",
        note: "one-stop majority shaped stint length and tyre exposure.",
      },
      {
        label: "Position factor",
        value: "LAW had the largest start-finish gain proxy",
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
    winner: { code: "ANT", name: "Andrea Kimi Antonelli", team: "mercedes" },
    margin: "",
    strategy: "one-stop majority",
    lede: "ANT won for Mercedes.",
    keyReads: [
      {
        label: "Pace factor",
        value: "RUS held the strongest median race pace",
        note: "RUS held the strongest median race pace.",
      },
      {
        label: "Strategy factor",
        value: "one-stop majority shaped stint length and tyre exposure",
        note: "one-stop majority shaped stint length and tyre exposure.",
      },
      {
        label: "Position factor",
        value: "SAI had the largest start-finish gain proxy",
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
    winner: { code: "RUS", name: "Rus", team: "mercedes" },
    margin: "",
    strategy: "one-stop majority",
    lede: "RUS won for Mercedes.",
    keyReads: [
      {
        label: "Pace factor",
        value: "ANT held the strongest median race pace",
        note: "ANT held the strongest median race pace.",
      },
      {
        label: "Strategy factor",
        value: "one-stop majority shaped stint length and tyre exposure",
        note: "one-stop majority shaped stint length and tyre exposure.",
      },
      {
        label: "Position factor",
        value: "VER had the largest start-finish gain proxy",
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
