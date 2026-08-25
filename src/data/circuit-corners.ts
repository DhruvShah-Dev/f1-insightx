export type CircuitCorner = {
  number: number;
  name: string;
  x: number;
  y: number;
  sector: 1 | 2 | 3;
  speed: "slow" | "medium" | "fast";
  tooltipSide?: "left" | "right" | "above" | "below";
};

const ZANDVOORT_CORNERS: CircuitCorner[] = [
  { number: 1, name: "Tarzanbocht", x: 360.5, y: 35.1, sector: 1, speed: "slow", tooltipSide: "below" },
  { number: 2, name: "Gerlachbocht", x: 342.2, y: 224.7, sector: 1, speed: "medium", tooltipSide: "right" },
  { number: 3, name: "Hugenholtzbocht", x: 273.3, y: 292.6, sector: 1, speed: "slow", tooltipSide: "left" },
  { number: 4, name: "Hunserug", x: 405.1, y: 277.9, sector: 1, speed: "fast", tooltipSide: "above" },
  { number: 5, name: "Slotemakerbocht", x: 527.3, y: 289.2, sector: 1, speed: "fast", tooltipSide: "above" },
  { number: 6, name: "Scheivlak", x: 623.3, y: 245.5, sector: 1, speed: "fast", tooltipSide: "above" },
  { number: 7, name: "Scheivlak exit", x: 800.8, y: 287.9, sector: 2, speed: "fast", tooltipSide: "left" },
  { number: 8, name: "Mastersbocht", x: 712.3, y: 471.5, sector: 2, speed: "medium", tooltipSide: "left" },
  { number: 9, name: "Turn 9", x: 589.9, y: 422.9, sector: 2, speed: "medium", tooltipSide: "below" },
  { number: 10, name: "Turn 10", x: 720.1, y: 338.4, sector: 2, speed: "medium", tooltipSide: "left" },
  { number: 11, name: "Hans Ernst Chicane", x: 358.6, y: 376.3, sector: 2, speed: "slow", tooltipSide: "right" },
  { number: 12, name: "Hans Ernst Chicane exit", x: 308.6, y: 368.2, sector: 2, speed: "slow", tooltipSide: "left" },
  { number: 13, name: "Kumhobocht", x: 327, y: 566.6, sector: 3, speed: "medium", tooltipSide: "right" },
  { number: 14, name: "Arie Luyendykbocht", x: 166, y: 534.3, sector: 3, speed: "fast", tooltipSide: "right" },
];

const MONZA_CORNERS: CircuitCorner[] = [
  { number: 1, name: "Variante del Rettifilo", x: 343, y: 233, sector: 1, speed: "slow", tooltipSide: "right" },
  { number: 2, name: "Variante del Rettifilo", x: 354, y: 223, sector: 1, speed: "slow", tooltipSide: "right" },
  { number: 3, name: "Curva Grande", x: 348, y: 156, sector: 1, speed: "fast", tooltipSide: "right" },
  { number: 4, name: "Variante della Roggia", x: 529, y: 67, sector: 1, speed: "slow", tooltipSide: "below" },
  { number: 5, name: "Variante della Roggia", x: 547, y: 53, sector: 2, speed: "slow", tooltipSide: "below" },
  { number: 6, name: "Prima Variante Lesmo", x: 637, y: 65, sector: 2, speed: "medium", tooltipSide: "left" },
  { number: 7, name: "Seconda Variante Lesmo", x: 619, y: 129, sector: 2, speed: "medium", tooltipSide: "left" },
  { number: 8, name: "Variante Ascari", x: 441, y: 262, sector: 2, speed: "medium", tooltipSide: "right" },
  { number: 9, name: "Variante Ascari", x: 423, y: 299, sector: 3, speed: "medium", tooltipSide: "right" },
  { number: 10, name: "Variante Ascari", x: 403, y: 337, sector: 3, speed: "medium", tooltipSide: "right" },
  { number: 11, name: "Curva Alboreto", x: 382, y: 557, sector: 3, speed: "fast", tooltipSide: "above" },
];

const CORNERS_BY_CIRCUIT: Record<string, CircuitCorner[]> = {
  zandvoort: ZANDVOORT_CORNERS,
  monza: MONZA_CORNERS,
};

const speedLabels = {
  slow: "Slow",
  medium: "Medium",
  fast: "Fast",
} as const;

export function cornersForCircuit(circuitId?: string | null) {
  return CORNERS_BY_CIRCUIT[circuitId ?? ""] ?? [];
}

export function cornerProfileForCircuit(circuitId?: string | null) {
  const corners = cornersForCircuit(circuitId);
  return (["slow", "fast", "medium"] as const)
    .map((speed) => {
      const grouped = corners.filter((corner) => corner.speed === speed);
      return {
        label: speedLabels[speed],
        value: String(grouped.length),
        detail: grouped.map((corner) => corner.name).join(", "),
      };
    })
    .filter((group) => group.value !== "0");
}

export function cornerSummaryForCircuit(circuitId?: string | null) {
  const groups = cornerProfileForCircuit(circuitId);
  const slow = groups.find((group) => group.label === "Slow")?.value;
  const fast = groups.find((group) => group.label === "Fast")?.value;
  if (slow && fast) return `${slow} slow / ${fast} fast`;
  return groups.map((group) => `${group.value} ${group.label.toLowerCase()}`).join(" / ") || "TBC";
}
