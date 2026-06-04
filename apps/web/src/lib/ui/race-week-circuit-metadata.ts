export type CircuitPoint = {
  x: number;
  y: number;
};

export type CircuitCornerMarker = CircuitPoint & {
  number: number;
  label: string;
  anchor?: CircuitPoint;
  tooltipSide?: "left" | "right" | "above" | "below";
};

export type CircuitSector = {
  id: "sector-1" | "sector-2" | "sector-3";
  label: string;
  startPercent: number;
  endPercent: number;
  color: string;
};

export type CircuitDataCallout = {
  id: string;
  label: string;
  kind: "drs-detection" | "drs-activation" | "speed-trap";
  anchor: CircuitPoint;
  labelPosition: CircuitPoint;
  width: number;
};

export type RaceWeekCircuitMetadata = {
  circuitId: string;
  viewBox: string;
  corners: CircuitCornerMarker[];
  sectors: CircuitSector[];
  drsZones: CircuitDataCallout[];
  speedTraps: CircuitDataCallout[];
  startFinish: CircuitPoint;
  source: string;
  verified: boolean;
  note: string;
};

const monacoMetadata: RaceWeekCircuitMetadata = {
  circuitId: "monaco",
  viewBox: "190 15 555 590",
  corners: [
    { number: 1, x: 282, y: 295, label: "Sainte Devote", tooltipSide: "left" },
    { number: 2, x: 444, y: 262, label: "Beau Rivage", tooltipSide: "above" },
    { number: 3, x: 568, y: 217, label: "Massenet", tooltipSide: "left" },
    { number: 4, x: 575, y: 181, label: "Casino", tooltipSide: "left" },
    {
      number: 5,
      x: 598,
      y: 27,
      anchor: { x: 608, y: 47 },
      label: "Mirabeau Haute",
      tooltipSide: "left",
    },
    {
      number: 6,
      x: 674,
      y: 105,
      anchor: { x: 662, y: 88 },
      label: "Grand Hotel Hairpin",
      tooltipSide: "left",
    },
    {
      number: 7,
      x: 663,
      y: 48,
      anchor: { x: 649, y: 57 },
      label: "Mirabeau Bas",
      tooltipSide: "below",
    },
    { number: 8, x: 714, y: 43, anchor: { x: 695, y: 50 }, label: "Portier", tooltipSide: "left" },
    { number: 9, x: 653, y: 205, label: "Tunnel", tooltipSide: "right" },
    {
      number: 10,
      x: 482,
      y: 292,
      anchor: { x: 475, y: 276 },
      label: "Nouvelle Chicane",
      tooltipSide: "below",
    },
    {
      number: 11,
      x: 448,
      y: 309,
      anchor: { x: 451, y: 291 },
      label: "Nouvelle Chicane",
      tooltipSide: "below",
    },
    { number: 12, x: 301, y: 314, anchor: { x: 318, y: 304 }, label: "Tabac", tooltipSide: "above" },
    { number: 13, x: 278, y: 371, anchor: { x: 292, y: 378 }, label: "Louis Chiron", tooltipSide: "left" },
    { number: 14, x: 323, y: 413, anchor: { x: 307, y: 407 }, label: "Louis Chiron", tooltipSide: "right" },
    { number: 15, x: 318, y: 470, label: "Piscine", tooltipSide: "right" },
    { number: 16, x: 310, y: 503, label: "Piscine", tooltipSide: "left" },
    { number: 17, x: 330, y: 542, label: "La Rascasse approach", tooltipSide: "right" },
    { number: 18, x: 365, y: 570, label: "La Rascasse", tooltipSide: "right" },
    { number: 19, x: 318, y: 580, label: "Anthony Noghes", tooltipSide: "left" },
  ],
  sectors: [
    { id: "sector-1", label: "Sector 1", startPercent: 0, endPercent: 33.3, color: "#ff3f76" },
    { id: "sector-2", label: "Sector 2", startPercent: 33.3, endPercent: 66.6, color: "#38bdf8" },
    { id: "sector-3", label: "Sector 3", startPercent: 66.6, endPercent: 100, color: "#f6d84a" },
  ],
  drsZones: [
    {
      id: "monaco-drs-detection",
      label: "Overtake detection",
      kind: "drs-detection",
      anchor: { x: 319, y: 523 },
      labelPosition: { x: 352, y: 505 },
      width: 112,
    },
    {
      id: "monaco-drs-activation",
      label: "Overtake activation",
      kind: "drs-activation",
      anchor: { x: 341, y: 585 },
      labelPosition: { x: 402, y: 574 },
      width: 116,
    },
  ],
  speedTraps: [
    {
      id: "monaco-speed-trap",
      label: "Speed trap",
      kind: "speed-trap",
      anchor: { x: 548, y: 262 },
      labelPosition: { x: 558, y: 292 },
      width: 82,
    },
  ],
  startFinish: { x: 248, y: 399 },
  source: "Manual circuit annotation aligned to FastF1-derived path geometry",
  verified: false,
  note: "Corner and circuit-feature markers are approximate visual annotations.",
};

const circuitMetadata: Record<string, RaceWeekCircuitMetadata> = {
  monaco: monacoMetadata,
};

export function getRaceWeekCircuitMetadata(circuitId: string): RaceWeekCircuitMetadata | null {
  return circuitMetadata[circuitId] ?? null;
}
