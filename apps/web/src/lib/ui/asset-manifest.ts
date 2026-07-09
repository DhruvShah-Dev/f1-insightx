export type TeamAsset = {
  id: string;
  label: string;
  shortLabel: string;
  primary: string;
  secondary: string;
  accent: string;
  logoDarkPath?: string | null;
  logoLightPath?: string | null;
  logoMonoPath?: string | null;
  preferredLogoPlate?: "dark" | "light" | "transparent";
  badgeAssetPath: string | null;
  badgePlate?: "default" | "dark" | "light" | "gold";
  badgeContrastColor?: string;
  carImagePath: string | null;
  carImageAlt: string;
  fallbackImagePath: string;
  imageFit?: "cover" | "contain";
  imagePosition?: string;
};

export type TeamLogoTheme = "dark" | "light" | "mono";

export type CircuitAsset = {
  id: string;
  displayName: string;
  countryCode: string;
  region: string;
  layoutAssetPath: string | null;
  layoutSourceLabel: string | null;
  layoutSourceUrl: string | null;
  geoJsonFeatureId: string | null;
  lapRecordTime: string | null;
  lapRecordDriver: string | null;
  lapRecordYear: number | null;
};

const sharedTeamFallback = "/assets/teams/2026/fallback/car-placeholder.svg";

const fallbackTeam: TeamAsset = {
  id: "default",
  label: "Constructor",
  shortLabel: "TEAM",
  primary: "#636b78",
  secondary: "#9da6b2",
  accent: "#e10600",
  logoDarkPath: null,
  logoLightPath: null,
  logoMonoPath: null,
  preferredLogoPlate: "dark",
  badgeAssetPath: null,
  carImagePath: null,
  carImageAlt: "Formula 1 constructor media placeholder",
  fallbackImagePath: sharedTeamFallback,
};

const fallbackCircuit: CircuitAsset = {
  id: "default",
  displayName: "Circuit pending",
  countryCode: "--",
  region: "Circuit",
  layoutAssetPath: null,
  layoutSourceLabel: null,
  layoutSourceUrl: null,
  geoJsonFeatureId: null,
  lapRecordTime: null,
  lapRecordDriver: null,
  lapRecordYear: null,
};

export const CURRENT_2026_TEAM_IDS = [
  "mercedes",
  "ferrari",
  "mclaren",
  "haas",
  "red_bull",
  "racing_bulls",
  "alpine",
  "audi",
  "williams",
  "cadillac",
  "aston_martin",
] as const;

const teamAliases: Record<string, string> = {
  "aston martin": "aston_martin",
  "aston_martin": "aston_martin",
  "red bull": "red_bull",
  "red bull racing": "red_bull",
  "red_bull_racing": "red_bull",
  "mclaren": "mclaren",
  "mercedes": "mercedes",
  "ferrari": "ferrari",
  "haas": "haas",
  "haas f1 team": "haas",
  rb: "racing_bulls",
  alphatauri: "racing_bulls",
  haas_f1_team: "haas",
  "racing bulls": "racing_bulls",
  "racing_bulls": "racing_bulls",
  "alpine": "alpine",
  "audi": "audi",
  "williams": "williams",
  "williams racing": "williams",
  "cadillac": "cadillac",
};

const teamAssetMap: Record<string, TeamAsset> = {
  mercedes: {
    id: "mercedes",
    label: "Mercedes",
    shortLabel: "MER",
    primary: "#00d2be",
    secondary: "#7ef5e7",
    accent: "#d9dde3",
    badgeAssetPath: "/assets/teams/logos/mercedes.svg",
    badgePlate: "dark",
    badgeContrastColor: "#d9dde3",
    carImagePath: "/assets/teams/2026/cars/mercedes.webp",
    carImageAlt: "Mercedes AMG Petronas 2026 Formula 1 car",
    fallbackImagePath: sharedTeamFallback,
    imagePosition: "center 58%",
  },
  ferrari: {
    id: "ferrari",
    label: "Ferrari",
    shortLabel: "FER",
    primary: "#dc0000",
    secondary: "#ffda59",
    accent: "#ffffff",
    badgeAssetPath: "/assets/teams/logos/ferrari.svg",
    badgePlate: "gold",
    badgeContrastColor: "#ffda59",
    carImagePath: "/assets/teams/2026/cars/ferrari.webp",
    carImageAlt: "Scuderia Ferrari 2026 Formula 1 car",
    fallbackImagePath: sharedTeamFallback,
    imagePosition: "center center",
  },
  mclaren: {
    id: "mclaren",
    label: "McLaren",
    shortLabel: "MCL",
    primary: "#ff8700",
    secondary: "#89f0ff",
    accent: "#ffffff",
    badgeAssetPath: "/assets/teams/logos/mclaren.svg",
    badgePlate: "light",
    badgeContrastColor: "#ff8700",
    carImagePath: "/assets/teams/2026/cars/mclaren.webp",
    carImageAlt: "McLaren 2026 Formula 1 car",
    fallbackImagePath: sharedTeamFallback,
    imagePosition: "center 52%",
  },
  haas: {
    id: "haas",
    label: "Haas F1 Team",
    shortLabel: "HAA",
    primary: "#8f97a3",
    secondary: "#ff3b30",
    accent: "#ffffff",
    badgeAssetPath: "/assets/teams/logos/haas.svg",
    badgePlate: "light",
    badgeContrastColor: "#ffffff",
    carImagePath: "/assets/teams/2026/cars/haas.webp",
    carImageAlt: "Haas F1 Team 2026 Formula 1 car",
    fallbackImagePath: sharedTeamFallback,
    imagePosition: "center 48%",
  },
  red_bull: {
    id: "red_bull",
    label: "Red Bull Racing",
    shortLabel: "RBR",
    primary: "#1e41ff",
    secondary: "#f5c542",
    accent: "#dc143c",
    badgeAssetPath: "/assets/teams/logos/red-bull.svg",
    badgePlate: "dark",
    badgeContrastColor: "#f5c542",
    carImagePath: "/assets/teams/2026/cars/red-bull.webp",
    carImageAlt: "Oracle Red Bull Racing 2026 Formula 1 car",
    fallbackImagePath: sharedTeamFallback,
    imagePosition: "center 52%",
  },
  racing_bulls: {
    id: "racing_bulls",
    label: "Racing Bulls",
    shortLabel: "RB",
    primary: "#4d63ff",
    secondary: "#d7dce4",
    accent: "#ffffff",
    badgeAssetPath: null,
    badgePlate: "dark",
    badgeContrastColor: "#d7dce4",
    carImagePath: "/assets/teams/2026/cars/racing-bulls.webp",
    carImageAlt: "Racing Bulls 2026 Formula 1 car",
    fallbackImagePath: sharedTeamFallback,
    imagePosition: "center 52%",
  },
  alpine: {
    id: "alpine",
    label: "Alpine",
    shortLabel: "ALP",
    primary: "#0090ff",
    secondary: "#ff4db8",
    accent: "#dfe6ee",
    badgeAssetPath: null,
    badgePlate: "dark",
    badgeContrastColor: "#dfe6ee",
    carImagePath: "/assets/teams/2026/cars/alpine.webp",
    carImageAlt: "BWT Alpine 2026 Formula 1 car",
    fallbackImagePath: sharedTeamFallback,
    imagePosition: "center 52%",
  },
  audi: {
    id: "audi",
    label: "Audi",
    shortLabel: "AUD",
    primary: "#d10000",
    secondary: "#eceff4",
    accent: "#ffffff",
    badgeAssetPath: "/assets/teams/logos/audi.svg",
    badgePlate: "light",
    badgeContrastColor: "#eceff4",
    carImagePath: "/assets/teams/2026/cars/audi.webp",
    carImageAlt: "Audi 2026 Formula 1 car",
    fallbackImagePath: sharedTeamFallback,
    imagePosition: "center 54%",
  },
  williams: {
    id: "williams",
    label: "Williams",
    shortLabel: "WIL",
    primary: "#005aff",
    secondary: "#8fbeff",
    accent: "#ffffff",
    badgeAssetPath: "/assets/teams/logos/williams.svg",
    badgePlate: "light",
    badgeContrastColor: "#8fbeff",
    carImagePath: "/assets/teams/2026/cars/williams.webp",
    carImageAlt: "Williams Racing 2026 Formula 1 car",
    fallbackImagePath: sharedTeamFallback,
    imagePosition: "center 46%",
  },
  cadillac: {
    id: "cadillac",
    label: "Cadillac",
    shortLabel: "CAD",
    primary: "#f5f7fb",
    secondary: "#131922",
    accent: "#8cb4ff",
    badgeAssetPath: "/assets/teams/logos/cadillac.svg",
    badgePlate: "light",
    badgeContrastColor: "#f5f7fb",
    carImagePath: "/assets/teams/2026/cars/cadillac.webp",
    carImageAlt: "Cadillac 2026 Formula 1 car",
    fallbackImagePath: sharedTeamFallback,
    imagePosition: "center 58%",
  },
  aston_martin: {
    id: "aston_martin",
    label: "Aston Martin",
    shortLabel: "AMR",
    primary: "#006f62",
    secondary: "#7ad7c8",
    accent: "#ced4db",
    badgeAssetPath: "/assets/teams/logos/aston-martin.svg",
    badgePlate: "light",
    badgeContrastColor: "#7ad7c8",
    carImagePath: "/assets/teams/2026/cars/aston-martin.webp",
    carImageAlt: "Aston Martin Aramco 2026 Formula 1 car",
    fallbackImagePath: sharedTeamFallback,
    imagePosition: "center 48%",
  },
  sauber: {
    id: "sauber",
    label: "Sauber",
    shortLabel: "SAU",
    primary: "#52e252",
    secondary: "#d8ff8c",
    accent: "#101410",
    badgeAssetPath: null,
    carImagePath: null,
    carImageAlt: "Sauber Formula 1 team media placeholder",
    fallbackImagePath: sharedTeamFallback,
  },
  alfa: {
    id: "alfa",
    label: "Alfa Romeo",
    shortLabel: "ALF",
    primary: "#8b0000",
    secondary: "#f0f0f0",
    accent: "#ffffff",
    badgeAssetPath: null,
    carImagePath: null,
    carImageAlt: "Alfa Romeo Formula 1 team media placeholder",
    fallbackImagePath: sharedTeamFallback,
  },
};

const circuitAssetMap: Record<string, CircuitAsset> = {
  bahrain: {
    id: "bahrain",
    displayName: "Bahrain International Circuit",
    countryCode: "BH",
    region: "Sakhir",
    layoutAssetPath: "/assets/circuits/bahrain.svg",
    layoutSourceLabel: "Wikimedia Commons",
    layoutSourceUrl:
      "https://commons.wikimedia.org/wiki/File:Bahrain_International_Circuit--Grand_Prix_Layout_with_DRS.svg",
    geoJsonFeatureId: "bh-2002",
    lapRecordTime: null,
    lapRecordDriver: null,
    lapRecordYear: null,
  },
  jeddah: {
    id: "jeddah",
    displayName: "Jeddah Corniche Circuit",
    countryCode: "SA",
    region: "Jeddah",
    layoutAssetPath: "/assets/circuits/jeddah.svg",
    layoutSourceLabel: "Wikimedia Commons",
    layoutSourceUrl: "https://commons.wikimedia.org/wiki/File:Jeddah_Street_Circuit_2021.svg",
    geoJsonFeatureId: "sa-2021",
    lapRecordTime: null,
    lapRecordDriver: null,
    lapRecordYear: null,
  },
  albert_park: {
    id: "albert_park",
    displayName: "Albert Park Circuit",
    countryCode: "AU",
    region: "Melbourne",
    layoutAssetPath: "/assets/circuits/albert_park.svg",
    layoutSourceLabel: "Wikimedia Commons",
    layoutSourceUrl: "https://commons.wikimedia.org/wiki/File:Albert_Park_Circuit_2021.svg",
    geoJsonFeatureId: "au-1953",
    lapRecordTime: "1:19.813",
    lapRecordDriver: "Charles Leclerc",
    lapRecordYear: 2024,
  },
  monaco: {
    id: "monaco",
    displayName: "Circuit de Monaco",
    countryCode: "MC",
    region: "Monte Carlo",
    layoutAssetPath: "/assets/circuits/monaco.svg",
    layoutSourceLabel: "Wikimedia Commons",
    layoutSourceUrl: "https://commons.wikimedia.org/wiki/File:Circuit_Monaco.svg",
    geoJsonFeatureId: "mc-1929",
    lapRecordTime: null,
    lapRecordDriver: null,
    lapRecordYear: null,
  },
  silverstone: {
    id: "silverstone",
    displayName: "Silverstone Circuit",
    countryCode: "GB",
    region: "Silverstone",
    layoutAssetPath: "/assets/circuits/silverstone.svg",
    layoutSourceLabel: "Wikimedia Commons",
    layoutSourceUrl: "https://commons.wikimedia.org/wiki/File:Circuit_Silverstone_2011.svg",
    geoJsonFeatureId: "gb-1948",
    lapRecordTime: null,
    lapRecordDriver: null,
    lapRecordYear: null,
  },
  shanghai: {
    id: "shanghai",
    displayName: "Shanghai International Circuit",
    countryCode: "CN",
    region: "Shanghai",
    layoutAssetPath: null,
    layoutSourceLabel: null,
    layoutSourceUrl: null,
    geoJsonFeatureId: "cn-2004",
    lapRecordTime: "1:32.238",
    lapRecordDriver: "Michael Schumacher",
    lapRecordYear: 2004,
  },
  miami: {
    id: "miami",
    displayName: "Miami International Autodrome",
    countryCode: "US",
    region: "Miami",
    layoutAssetPath: null,
    layoutSourceLabel: null,
    layoutSourceUrl: null,
    geoJsonFeatureId: null,
    lapRecordTime: null,
    lapRecordDriver: null,
    lapRecordYear: null,
  },
  suzuka: {
    id: "suzuka",
    displayName: "Suzuka Circuit",
    countryCode: "JP",
    region: "Suzuka",
    layoutAssetPath: null,
    layoutSourceLabel: null,
    layoutSourceUrl: null,
    geoJsonFeatureId: "jp-1962",
    lapRecordTime: null,
    lapRecordDriver: null,
    lapRecordYear: null,
  },
  monza: {
    id: "monza",
    displayName: "Autodromo Nazionale Monza",
    countryCode: "IT",
    region: "Monza",
    layoutAssetPath: null,
    layoutSourceLabel: null,
    layoutSourceUrl: null,
    geoJsonFeatureId: "it-1922",
    lapRecordTime: null,
    lapRecordDriver: null,
    lapRecordYear: null,
  },
  marina_bay: {
    id: "marina_bay",
    displayName: "Marina Bay Street Circuit",
    countryCode: "SG",
    region: "Singapore",
    layoutAssetPath: null,
    layoutSourceLabel: null,
    layoutSourceUrl: null,
    geoJsonFeatureId: "sg-2008",
    lapRecordTime: null,
    lapRecordDriver: null,
    lapRecordYear: null,
  },
  villeneuve: {
    id: "villeneuve",
    displayName: "Circuit Gilles Villeneuve",
    countryCode: "CA",
    region: "Montreal",
    layoutAssetPath: null,
    layoutSourceLabel: null,
    layoutSourceUrl: null,
    geoJsonFeatureId: "ca-1978",
    lapRecordTime: null,
    lapRecordDriver: null,
    lapRecordYear: null,
  },
  zandvoort: {
    id: "zandvoort",
    displayName: "Circuit Zandvoort",
    countryCode: "NL",
    region: "Zandvoort",
    layoutAssetPath: null,
    layoutSourceLabel: null,
    layoutSourceUrl: null,
    geoJsonFeatureId: "nl-1948",
    lapRecordTime: null,
    lapRecordDriver: null,
    lapRecordYear: null,
  },
  catalunya: {
    id: "catalunya",
    displayName: "Circuit de Barcelona-Catalunya",
    countryCode: "ES",
    region: "Barcelona",
    layoutAssetPath: null,
    layoutSourceLabel: null,
    layoutSourceUrl: null,
    geoJsonFeatureId: "es-1991",
    lapRecordTime: null,
    lapRecordDriver: null,
    lapRecordYear: null,
  },
  hungaroring: {
    id: "hungaroring",
    displayName: "Hungaroring",
    countryCode: "HU",
    region: "Budapest",
    layoutAssetPath: null,
    layoutSourceLabel: null,
    layoutSourceUrl: null,
    geoJsonFeatureId: "hu-1986",
    lapRecordTime: null,
    lapRecordDriver: null,
    lapRecordYear: null,
  },
  spa: {
    id: "spa",
    displayName: "Circuit de Spa-Francorchamps",
    countryCode: "BE",
    region: "Spa",
    layoutAssetPath: null,
    layoutSourceLabel: null,
    layoutSourceUrl: null,
    geoJsonFeatureId: "be-1925",
    lapRecordTime: null,
    lapRecordDriver: null,
    lapRecordYear: null,
  },
  baku: {
    id: "baku",
    displayName: "Baku City Circuit",
    countryCode: "AZ",
    region: "Baku",
    layoutAssetPath: null,
    layoutSourceLabel: null,
    layoutSourceUrl: null,
    geoJsonFeatureId: "az-2016",
    lapRecordTime: null,
    lapRecordDriver: null,
    lapRecordYear: null,
  },
  yas_marina: {
    id: "yas_marina",
    displayName: "Yas Marina Circuit",
    countryCode: "AE",
    region: "Yas Marina",
    layoutAssetPath: null,
    layoutSourceLabel: null,
    layoutSourceUrl: null,
    geoJsonFeatureId: "ae-2009",
    lapRecordTime: "1:26.103",
    lapRecordDriver: "Max Verstappen",
    lapRecordYear: 2021,
  },
  losail: {
    id: "losail",
    displayName: "Lusail International Circuit",
    countryCode: "QA",
    region: "Lusail",
    layoutAssetPath: null,
    layoutSourceLabel: null,
    layoutSourceUrl: null,
    geoJsonFeatureId: "qa-2004",
    lapRecordTime: null,
    lapRecordDriver: null,
    lapRecordYear: null,
  },
  vegas: {
    id: "vegas",
    displayName: "Las Vegas Strip Circuit",
    countryCode: "US",
    region: "Las Vegas",
    layoutAssetPath: null,
    layoutSourceLabel: null,
    layoutSourceUrl: null,
    geoJsonFeatureId: "us-2023",
    lapRecordTime: null,
    lapRecordDriver: null,
    lapRecordYear: null,
  },
  red_bull_ring: {
    id: "red_bull_ring",
    displayName: "Red Bull Ring",
    countryCode: "AT",
    region: "Spielberg",
    layoutAssetPath: null,
    layoutSourceLabel: null,
    layoutSourceUrl: null,
    geoJsonFeatureId: "at-1969",
    lapRecordTime: null,
    lapRecordDriver: null,
    lapRecordYear: null,
  },
  imola: {
    id: "imola",
    displayName: "Autodromo Enzo e Dino Ferrari",
    countryCode: "IT",
    region: "Imola",
    layoutAssetPath: null,
    layoutSourceLabel: null,
    layoutSourceUrl: null,
    geoJsonFeatureId: "it-1953",
    lapRecordTime: null,
    lapRecordDriver: null,
    lapRecordYear: null,
  },
  interlagos: {
    id: "interlagos",
    displayName: "Autodromo Jose Carlos Pace",
    countryCode: "BR",
    region: "Sao Paulo",
    layoutAssetPath: null,
    layoutSourceLabel: null,
    layoutSourceUrl: null,
    geoJsonFeatureId: "br-1940",
    lapRecordTime: null,
    lapRecordDriver: null,
    lapRecordYear: null,
  },
  americas: {
    id: "americas",
    displayName: "Circuit of the Americas",
    countryCode: "US",
    region: "Austin",
    layoutAssetPath: null,
    layoutSourceLabel: null,
    layoutSourceUrl: null,
    geoJsonFeatureId: "us-2012",
    lapRecordTime: null,
    lapRecordDriver: null,
    lapRecordYear: null,
  },
  rodriguez: {
    id: "rodriguez",
    displayName: "Autodromo Hermanos Rodriguez",
    countryCode: "MX",
    region: "Mexico City",
    layoutAssetPath: null,
    layoutSourceLabel: null,
    layoutSourceUrl: null,
    geoJsonFeatureId: "mx-1962",
    lapRecordTime: null,
    lapRecordDriver: null,
    lapRecordYear: null,
  },
};

export function getTeamAsset(teamId: string | null | undefined): TeamAsset {
  if (!teamId) {
    return fallbackTeam;
  }

  const teamKey = String(teamId).trim();
  const slugTeamId = teamKey
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const labelMatch = Object.values(teamAssetMap).find((team) => (
    team.label.toLowerCase() === teamKey.toLowerCase()
    || team.shortLabel.toLowerCase() === teamKey.toLowerCase()
  ));
  const normalizedTeamId = teamAliases[teamKey] ?? teamAliases[teamKey.toLowerCase()] ?? teamAliases[slugTeamId] ?? labelMatch?.id ?? slugTeamId;

  return resolveTeamAsset(teamAssetMap[normalizedTeamId] ?? {
    ...fallbackTeam,
    id: normalizedTeamId,
    label: normalizedTeamId.replaceAll("_", " "),
  });
}

export function getTeamLogoPath(team: TeamAsset, theme: TeamLogoTheme = "dark"): string | null {
  if (theme === "light") {
    return team.logoLightPath ?? team.logoDarkPath ?? team.badgeAssetPath ?? null;
  }

  if (theme === "mono") {
    return team.logoMonoPath ?? team.logoDarkPath ?? team.badgeAssetPath ?? null;
  }

  return team.logoDarkPath ?? team.badgeAssetPath ?? null;
}

function resolveTeamAsset(team: TeamAsset): TeamAsset {
  const logoPaths = resolveTeamLogoPaths(team.badgeAssetPath);
  const carImagePath = resolveTeamCarPath(team.carImagePath);

  return {
    ...team,
    logoDarkPath: team.logoDarkPath ?? logoPaths.dark,
    logoLightPath: team.logoLightPath ?? logoPaths.light,
    logoMonoPath: team.logoMonoPath ?? logoPaths.mono,
    preferredLogoPlate: team.preferredLogoPlate ?? logoPlateToPreference(team.badgePlate),
    badgeAssetPath: team.badgeAssetPath ? (team.logoDarkPath ?? logoPaths.dark ?? team.badgeAssetPath) : null,
    carImagePath,
  };
}

function resolveTeamCarPath(carImagePath: string | null): string | null {
  if (!carImagePath) {
    return null;
  }

  if (carImagePath.includes("/assets/teams/2026/cars/")) {
    return carImagePath;
  }

  return carImagePath.replace("/assets/teams/2026/", "/assets/teams/2026/cars/");
}

function resolveTeamLogoPaths(badgeAssetPath: string | null): Record<TeamLogoTheme, string | null> {
  if (!badgeAssetPath) {
    return { dark: null, light: null, mono: null };
  }

  const filename = badgeAssetPath.split("/").at(-1);
  if (!filename) {
    return { dark: badgeAssetPath, light: badgeAssetPath, mono: badgeAssetPath };
  }

  return {
    dark: `/assets/teams/logos/dark/${filename}`,
    light: `/assets/teams/logos/light/${filename}`,
    mono: `/assets/teams/logos/mono/${filename}`,
  };
}

function logoPlateToPreference(plate: TeamAsset["badgePlate"]): TeamAsset["preferredLogoPlate"] {
  if (plate === "light" || plate === "gold") {
    return "light";
  }

  return plate === "dark" ? "dark" : "transparent";
}

export function getCircuitAsset(circuitId: string | null | undefined): CircuitAsset {
  if (!circuitId) {
    return fallbackCircuit;
  }

  return circuitAssetMap[circuitId] ?? {
    ...fallbackCircuit,
    id: circuitId,
    region: circuitId.replaceAll("_", " "),
  };
}
