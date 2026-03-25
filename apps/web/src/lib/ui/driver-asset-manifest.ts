export type CurrentDriverMeta = {
  driverId: string;
  displayName: string;
  firstName: string;
  lastName: string;
  teamId: string;
  currentTeamName: string;
  driverCode: string;
  nationality: string;
  photoPath: string | null;
  fallbackPhotoPath: string;
  altText: string;
  formula1TeamSlug?: string;
  formula1AssetCode?: string;
  photoPosition?: string;
  photoFit?: "cover" | "contain";
  photoScale?: number;
  sourceTag?: string;
};

const sharedDriverFallback = "/assets/drivers/driver-placeholder.svg";

export const CURRENT_2026_DRIVER_IDS = [
  "russell",
  "antonelli",
  "leclerc",
  "hamilton",
  "norris",
  "piastri",
  "ocon",
  "bearman",
  "max_verstappen",
  "hadjar",
  "lawson",
  "arvid_lindblad",
  "gasly",
  "colapinto",
  "hulkenberg",
  "bortoleto",
  "sainz",
  "albon",
  "perez",
  "bottas",
  "alonso",
  "stroll",
] as const;

const fallbackDriver: CurrentDriverMeta = {
  driverId: "default",
  displayName: "Driver",
  firstName: "Current",
  lastName: "Driver",
  teamId: "default",
  currentTeamName: "Constructor",
  driverCode: "DRV",
  nationality: "Nationality pending",
  photoPath: null,
  fallbackPhotoPath: sharedDriverFallback,
  altText: "Formula 1 driver portrait placeholder",
  photoPosition: "center top",
  photoFit: "contain",
  photoScale: 1,
  sourceTag: "fallback",
};

const currentDriverMap: Record<string, CurrentDriverMeta> = {
  russell: createDriver("russell", "George Russell", "George", "Russell", "mercedes", "Mercedes", "RUS", "British", "mercedes", "georus01", {
    photoScale: 1.04,
  }),
  antonelli: createDriver("antonelli", "Kimi Antonelli", "Kimi", "Antonelli", "mercedes", "Mercedes", "ANT", "Italian", "mercedes", "andant01", {
    photoScale: 1.04,
  }),
  leclerc: createDriver("leclerc", "Charles Leclerc", "Charles", "Leclerc", "ferrari", "Ferrari", "LEC", "Monégasque", "ferrari", "chalec01", {
    photoScale: 1.03,
  }),
  hamilton: createDriver("hamilton", "Lewis Hamilton", "Lewis", "Hamilton", "ferrari", "Ferrari", "HAM", "British", "ferrari", "lewham01", {
    photoScale: 1.03,
  }),
  norris: createDriver("norris", "Lando Norris", "Lando", "Norris", "mclaren", "McLaren", "NOR", "British", "mclaren", "lannor01", {
    photoScale: 1.01,
  }),
  piastri: createDriver("piastri", "Oscar Piastri", "Oscar", "Piastri", "mclaren", "McLaren", "PIA", "Australian", "mclaren", "oscpia01", {
    photoScale: 1.03,
  }),
  ocon: createDriver("ocon", "Esteban Ocon", "Esteban", "Ocon", "haas", "Haas F1 Team", "OCO", "French", "haasf1team", "estoco01", {
    photoScale: 1.02,
  }),
  bearman: createDriver("bearman", "Oliver Bearman", "Oliver", "Bearman", "haas", "Haas F1 Team", "BEA", "British", "haasf1team", "olibea01", {
    photoScale: 1.01,
  }),
  max_verstappen: createDriver("max_verstappen", "Max Verstappen", "Max", "Verstappen", "red_bull", "Red Bull Racing", "VER", "Dutch", "redbullracing", "maxver01", {
    photoScale: 1.03,
  }),
  hadjar: createDriver("hadjar", "Isack Hadjar", "Isack", "Hadjar", "red_bull", "Red Bull Racing", "HAD", "French", "redbullracing", "isahad01", {
    photoScale: 1.02,
  }),
  lawson: createDriver("lawson", "Liam Lawson", "Liam", "Lawson", "racing_bulls", "Racing Bulls", "LAW", "New Zealander", "racingbulls", "lialaw01", {
    photoScale: 1.02,
  }),
  arvid_lindblad: createDriver(
    "arvid_lindblad",
    "Arvid Lindblad",
    "Arvid",
    "Lindblad",
    "racing_bulls",
    "Racing Bulls",
    "LIN",
    "British",
    "racingbulls",
    "arvlin01",
    {
      photoScale: 1.02,
    },
  ),
  gasly: createDriver("gasly", "Pierre Gasly", "Pierre", "Gasly", "alpine", "Alpine", "GAS", "French", "alpine", "piegas01", {
    photoScale: 1.02,
  }),
  colapinto: createDriver("colapinto", "Franco Colapinto", "Franco", "Colapinto", "alpine", "Alpine", "COL", "Argentine", "alpine", "fracol01", {
    photoScale: 1.02,
  }),
  hulkenberg: createDriver("hulkenberg", "Nico Hulkenberg", "Nico", "Hulkenberg", "audi", "Audi", "HUL", "German", "audi", "nichul01", {
    photoScale: 1.02,
  }),
  bortoleto: createDriver("bortoleto", "Gabriel Bortoleto", "Gabriel", "Bortoleto", "audi", "Audi", "BOR", "Brazilian", "audi", "gabbor01", {
    photoScale: 1.02,
  }),
  sainz: createDriver("sainz", "Carlos Sainz", "Carlos", "Sainz", "williams", "Williams", "SAI", "Spanish", "williams", "carsai01", {
    photoScale: 1.02,
  }),
  albon: createDriver("albon", "Alexander Albon", "Alexander", "Albon", "williams", "Williams", "ALB", "Thai", "williams", "alealb01", {
    photoScale: 1.02,
  }),
  perez: createDriver("perez", "Sergio Perez", "Sergio", "Perez", "cadillac", "Cadillac", "PER", "Mexican", "cadillac", "serper01", {
    photoScale: 1.02,
  }),
  bottas: createDriver("bottas", "Valtteri Bottas", "Valtteri", "Bottas", "cadillac", "Cadillac", "BOT", "Finnish", "cadillac", "valbot01", {
    photoScale: 1.01,
  }),
  alonso: createDriver("alonso", "Fernando Alonso", "Fernando", "Alonso", "aston_martin", "Aston Martin", "ALO", "Spanish", "astonmartin", "feralo01", {
    photoScale: 1.01,
  }),
  stroll: createDriver("stroll", "Lance Stroll", "Lance", "Stroll", "aston_martin", "Aston Martin", "STR", "Canadian", "astonmartin", "lanstr01", {
    photoScale: 1.01,
  }),
};

export function getCurrentDriverMeta(driverId: string | null | undefined): CurrentDriverMeta {
  if (!driverId) {
    return fallbackDriver;
  }

  return currentDriverMap[driverId] ?? {
    ...fallbackDriver,
    driverId,
    displayName: driverId.replaceAll("_", " "),
    lastName: driverId.replaceAll("_", " "),
    altText: `${driverId.replaceAll("_", " ")} portrait placeholder`,
  };
}

function createDriver(
  driverId: string,
  displayName: string,
  firstName: string,
  lastName: string,
  teamId: string,
  currentTeamName: string,
  driverCode: string,
  nationality: string,
  formula1TeamSlug: string,
  formula1AssetCode: string,
  overrides: Partial<CurrentDriverMeta> = {},
): CurrentDriverMeta {
  return {
    driverId,
    displayName,
    firstName,
    lastName,
    teamId,
    currentTeamName,
    driverCode,
    nationality,
    photoPath: `/assets/drivers/2026/${driverId}.webp`,
    fallbackPhotoPath: sharedDriverFallback,
    altText: `${displayName} portrait`,
    formula1TeamSlug,
    formula1AssetCode,
    photoPosition: "center bottom",
    photoFit: "contain",
    photoScale: 1.02,
    sourceTag: "formula1-driver-right-2026",
    ...overrides,
  };
}
