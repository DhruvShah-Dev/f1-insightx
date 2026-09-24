// Team identity helpers that work with the raw team/constructor names
// coming out of the database (e.g. "Alpine F1 Team", "RB", "Red Bull Racing").

type TeamIdentity = {
  key: string;
  name: string;
  short: string;
  color: string;
  logoPng?: string;
  logoSvg?: string;
};

const TEAMS: TeamIdentity[] = [
  teamIdentity("mercedes", "Mercedes", "MER", "#00d7b6", "mercedes"),
  teamIdentity("ferrari", "Ferrari", "FER", "#e8002d", "ferrari"),
  teamIdentity("mclaren", "McLaren", "MCL", "#ff8000", "mclaren"),
  teamIdentity("red_bull", "Red Bull Racing", "RBR", "#3671c6", "red-bull"),
  teamIdentity("rb", "Racing Bulls", "RB", "#6692ff", "racing-bulls"),
  teamIdentity("williams", "Williams", "WIL", "#64c4ff", "williams"),
  teamIdentity("alpine", "Alpine", "ALP", "#ff87bc", "alpine"),
  teamIdentity("aston_martin", "Aston Martin", "AMR", "#00665f", "aston-martin"),
  teamIdentity("audi", "Audi", "AUD", "#52e252", "audi"),
  teamIdentity("sauber", "Sauber", "SAU", "#52e252", "audi"),
  teamIdentity("haas", "Haas", "HAA", "#b6babd", "haas"),
  teamIdentity("cadillac", "Cadillac", "CAD", "#c9a227", "cadillac"),
];

const FALLBACK: TeamIdentity = {
  key: "unknown",
  name: "Unknown",
  short: "—",
  color: "#8a8f98",
};

function teamIdentity(
  key: string,
  name: string,
  short: string,
  color: string,
  logoKey: string,
): TeamIdentity {
  const logoBase = "/assets/teams/logos/2026";
  return {
    key,
    name,
    short,
    color,
    logoPng: `${logoBase}/white-png/${logoKey}.png`,
    logoSvg: `${logoBase}/white-svg/${logoKey}.svg`,
  };
}

export function team(nameOrId: string | null | undefined): TeamIdentity {
  if (!nameOrId) return FALLBACK;
  const n = nameOrId
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .trim();
  if (n.includes("racing bull") || n === "rb" || n.includes("visa")) return TEAMS[4]!;
  if (n.includes("red bull")) return TEAMS[3]!;
  const direct = TEAMS.find(
    (t) => n.includes(t.key.replace("_", " ")) || n.includes(t.name.toLowerCase()),
  );
  return direct ?? { ...FALLBACK, name: nameOrId };
}

export function teamColor(nameOrId: string | null | undefined) {
  return team(nameOrId).color;
}

/* ---------------- comparison colours ---------------- */

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const v =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  return [
    parseInt(v.slice(0, 2), 16),
    parseInt(v.slice(2, 4), 16),
    parseInt(v.slice(4, 6), 16),
  ] as [number, number, number];
}

const toHex = (n: number) =>
  Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, "0");

/** Lightens toward white — keeps the team hue readable on the dark surfaces. */
function tint(hex: string, amount: number) {
  const [r, g, b] = hexToRgb(hex);
  return `#${toHex(r + (255 - r) * amount)}${toHex(g + (255 - g) * amount)}${toHex(b + (255 - b) * amount)}`;
}

/** Darkens toward black. */
function shade(hex: string, amount: number) {
  const [r, g, b] = hexToRgb(hex);
  return `#${toHex(r * (1 - amount))}${toHex(g * (1 - amount))}${toHex(b * (1 - amount))}`;
}

function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/**
 * Colours for a two-driver comparison. Different teams keep their own liveries;
 * teammates would otherwise render as one indistinguishable colour, so the
 * second driver gets a clearly separated light/dark variant of the same livery
 * (and callers can flag the pairing as a teammate duel).
 */
export function duelColors(
  teamAName: string | null | undefined,
  teamBName: string | null | undefined,
): { colorA: string; colorB: string; sameTeam: boolean } {
  const a = team(teamAName);
  const b = team(teamBName);
  const sameTeam = a.key === b.key && a.key !== "unknown";
  if (!sameTeam) return { colorA: a.color, colorB: b.color, sameTeam: false };
  // bright liveries split light/dark the other way round so both stay visible
  const bright = luminance(a.color) > 0.45;
  return bright
    ? { colorA: a.color, colorB: shade(a.color, 0.45), sameTeam: true }
    : { colorA: a.color, colorB: tint(a.color, 0.62), sameTeam: true };
}
