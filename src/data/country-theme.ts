// Presentation-only country accents used to theme the race-week page.
type CountryTheme = { flag: string[]; accent: string; label: string };

const normalizeKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const THEMES: Record<string, CountryTheme> = {
  netherlands: { flag: ["#ae1c28", "#ffffff", "#21468b"], accent: "#ff6a00", label: "Nederland" },
  italy: { flag: ["#008c45", "#ffffff", "#cd212a"], accent: "#008c45", label: "Italia" },
  monaco: { flag: ["#ce1126", "#ffffff"], accent: "#ce1126", label: "Monaco" },
  spain: { flag: ["#aa151b", "#f1bf00", "#aa151b"], accent: "#f1bf00", label: "España" },
  belgium: { flag: ["#000000", "#fdda24", "#ef3340"], accent: "#fdda24", label: "Belgique" },
  uk: { flag: ["#012169", "#ffffff", "#c8102e"], accent: "#c8102e", label: "United Kingdom" },
  "united kingdom": {
    flag: ["#012169", "#ffffff", "#c8102e"],
    accent: "#c8102e",
    label: "United Kingdom",
  },
  hungary: { flag: ["#ce2939", "#ffffff", "#477050"], accent: "#ce2939", label: "Magyarország" },
  austria: { flag: ["#ed2939", "#ffffff", "#ed2939"], accent: "#ed2939", label: "Osterreich" },
  japan: { flag: ["#ffffff", "#bc002d", "#ffffff"], accent: "#bc002d", label: "日本" },
  usa: { flag: ["#3c3b6e", "#ffffff", "#b22234"], accent: "#b22234", label: "United States" },
  "united states": {
    flag: ["#3c3b6e", "#ffffff", "#b22234"],
    accent: "#b22234",
    label: "United States",
  },
  mexico: { flag: ["#006847", "#ffffff", "#ce1126"], accent: "#006847", label: "México" },
  brazil: { flag: ["#009c3b", "#ffdf00", "#002776"], accent: "#ffdf00", label: "Brasil" },
  canada: { flag: ["#ff0000", "#ffffff", "#ff0000"], accent: "#ff0000", label: "Canada" },
  bahrain: { flag: ["#ffffff", "#ce1126"], accent: "#ce1126", label: "Bahrain" },
  "saudi arabia": { flag: ["#006c35", "#ffffff"], accent: "#006c35", label: "Saudi Arabia" },
  australia: { flag: ["#012169", "#ffffff", "#e4002b"], accent: "#012169", label: "Australia" },
  azerbaijan: { flag: ["#00b5e2", "#ef3340", "#509e2f"], accent: "#00b5e2", label: "Azərbaycan" },
  singapore: { flag: ["#ef3340", "#ffffff"], accent: "#ef3340", label: "Singapore" },
  qatar: { flag: ["#8a1538", "#ffffff"], accent: "#8a1538", label: "Qatar" },
  uae: {
    flag: ["#00732f", "#ffffff", "#ff0000"],
    accent: "#00732f",
    label: "United Arab Emirates",
  },
  china: { flag: ["#de2910", "#ffde00", "#de2910"], accent: "#de2910", label: "中国" },
  france: { flag: ["#0055a4", "#ffffff", "#ef4135"], accent: "#0055a4", label: "France" },
  germany: { flag: ["#000000", "#dd0000", "#ffce00"], accent: "#dd0000", label: "Deutschland" },
  portugal: { flag: ["#046a38", "#da291c"], accent: "#046a38", label: "Portugal" },
};

const FALLBACK: CountryTheme = {
  flag: ["#e8002d", "#ffffff", "#111214"],
  accent: "#e8002d",
  label: "Grand Prix",
};

const CIRCUIT_COUNTRIES: Record<string, string> = {
  albert_park: "Australia",
  bahrain: "Bahrain",
  shanghai: "China",
  suzuka: "Japan",
  miami: "USA",
  imola: "Italy",
  monaco: "Monaco",
  catalunya: "Spain",
  villeneuve: "Canada",
  silverstone: "UK",
  red_bull_ring: "Austria",
  spa: "Belgium",
  hungaroring: "Hungary",
  zandvoort: "Netherlands",
  monza: "Italy",
  baku: "Azerbaijan",
  marina_bay: "Singapore",
  americas: "USA",
  rodriguez: "Mexico",
  interlagos: "Brazil",
  las_vegas: "USA",
  vegas: "USA",
  losail: "Qatar",
  yas_marina: "UAE",
  jeddah: "Saudi Arabia",
};

const RACE_NAME_COUNTRIES: Array<[RegExp, string]> = [
  [/\baustralian\b/i, "Australia"],
  [/\bchinese\b/i, "China"],
  [/\bjapanese\b/i, "Japan"],
  [/\bmiami\b|\bunited states\b|\blas vegas\b/i, "USA"],
  [/\bemilia romagna\b|\bitalian\b/i, "Italy"],
  [/\bmonaco\b/i, "Monaco"],
  [/\bspanish\b/i, "Spain"],
  [/\bcanadian\b/i, "Canada"],
  [/\bbritish\b/i, "UK"],
  [/\baustrian\b/i, "Austria"],
  [/\bbelgian\b/i, "Belgium"],
  [/\bhungarian\b/i, "Hungary"],
  [/\bdutch\b/i, "Netherlands"],
  [/\bazerbaijan\b/i, "Azerbaijan"],
  [/\bsingapore\b/i, "Singapore"],
  [/\bmexican\b/i, "Mexico"],
  [/\bbrazilian\b/i, "Brazil"],
  [/\bqatar\b/i, "Qatar"],
  [/\babu dhabi\b/i, "UAE"],
  [/\bsaudi arabian\b/i, "Saudi Arabia"],
];

export function countryTheme(country: string | null | undefined): CountryTheme {
  if (!country) return FALLBACK;
  const key = country.trim().toLowerCase();
  return THEMES[key] ?? FALLBACK;
}

export function countryForRace({
  circuitId,
  circuit,
  raceName,
}: {
  circuitId?: string | null | undefined;
  circuit?: string | null | undefined;
  raceName?: string | null | undefined;
}) {
  const circuitKey = normalizeKey(circuitId ?? circuit ?? "");
  const byCircuit = CIRCUIT_COUNTRIES[circuitKey];
  if (byCircuit) return byCircuit;

  const text = [raceName, circuit].filter(Boolean).join(" ");
  return RACE_NAME_COUNTRIES.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}
