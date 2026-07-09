import generatedCircuitMetadata from "@/lib/ui/circuit-map-metadata.json";

export type CircuitPoint = {
  x: number;
  y: number;
};

export type CircuitCornerMarker = CircuitPoint & {
  number: number | string;
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
  displayLabel?: string;
  accessibilityLabel?: string;
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
  specs?: {
    circuitLengthKm: string;
    laps: number;
    raceDistanceKm: string;
  };
  source: string;
  verified: boolean;
  note: string;
};

type PendingCircuitMetadata = {
  circuitId: string;
  geometryPending: true;
  source: string;
  verified: false;
  note: string;
};

type CircuitMetadataRecord = RaceWeekCircuitMetadata | PendingCircuitMetadata;

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
  verified: true,
  note: "Corner and circuit-feature markers are approximate visual annotations.",
};

const redBullRingMetadata: RaceWeekCircuitMetadata = {
  circuitId: "red_bull_ring",
  viewBox: "0 0 960 620",
  corners: [
    { number: 1, x: 405.5, y: 583.6, label: "Niki Lauda Kurve", tooltipSide: "left" },
    { number: 2, x: 179.0, y: 205.5, label: "Turn 2 kink", tooltipSide: "right" },
    { number: 3, x: 46.9, y: 49.3, label: "Remus", tooltipSide: "right" },
    { number: 4, x: 600.4, y: 102.7, label: "Schlossgold", tooltipSide: "below" },
    { number: 5, x: 516.3, y: 188.5, label: "Turn 5", tooltipSide: "below" },
    { number: 6, x: 296.2, y: 198.2, label: "Rauch", tooltipSide: "right" },
    { number: 7, x: 391.0, y: 370.3, label: "Wurth", tooltipSide: "left" },
    { number: 8, x: 506.1, y: 294.0, label: "Turn 8", tooltipSide: "right" },
    { number: 9, x: 874.6, y: 300.7, label: "Jochen Rindt", tooltipSide: "left" },
    { number: 10, x: 911.6, y: 423.8, label: "Red Bull Mobile", tooltipSide: "left" },
  ],
  sectors: [
    { id: "sector-1", label: "Sector 1", startPercent: 0, endPercent: 31.5, color: "#ff3f76" },
    { id: "sector-2", label: "Sector 2", startPercent: 31.5, endPercent: 65.3, color: "#f6d84a" },
    { id: "sector-3", label: "Sector 3", startPercent: 65.3, endPercent: 100, color: "#38bdf8" },
  ],
  drsZones: [
    {
      id: "red-bull-ring-drs-detection-1",
      label: "Overtake detection",
      kind: "drs-detection",
      anchor: { x: 898, y: 353 },
      labelPosition: { x: 830, y: 306 },
      width: 116,
    },
    {
      id: "red-bull-ring-drs-activation-1",
      label: "Overtake activation",
      kind: "drs-activation",
      anchor: { x: 844, y: 474 },
      labelPosition: { x: 720, y: 410 },
      width: 118,
    },
  ],
  speedTraps: [
    {
      id: "red-bull-ring-speed-trap",
      label: "Speed trap",
      kind: "speed-trap",
      anchor: { x: 472, y: 82 },
      labelPosition: { x: 390, y: 120 },
      width: 82,
    },
  ],
  startFinish: { x: 678.3, y: 518.6 },
  source: "Manual Red Bull Ring annotation aligned to FastF1-derived path geometry",
  verified: true,
  note: "Corner names, sector guides, and overtake feature markers are approximate visual annotations for the F1 Grand Prix layout.",
};

const spaMetadata: RaceWeekCircuitMetadata = {
  circuitId: "spa",
  viewBox: "0 0 960 620",
  corners: [
    { number: 1, x: 364.4, y: 35.9, label: "La Source", tooltipSide: "below" },
    { number: 2, x: 507.5, y: 143.9, label: "Eau Rouge", tooltipSide: "right" },
    { number: 3, x: 529.7, y: 163.7, label: "Raidillon", tooltipSide: "right" },
    { number: 4, x: 536.1, y: 189.5, label: "Kemmel", tooltipSide: "right" },
    { number: 5, x: 651.2, y: 471.6, label: "Les Combes", tooltipSide: "left" },
    { number: 6, x: 638.5, y: 488.6, label: "Les Combes", tooltipSide: "left" },
    { number: 7, x: 642.2, y: 531.8, label: "Malmedy", tooltipSide: "left" },
    { number: 8, x: 556.3, y: 580.5, label: "Bruxelles", tooltipSide: "left" },
    { number: 9, x: 592.4, y: 533.3, label: "No Name", tooltipSide: "right" },
    { number: 10, x: 553.1, y: 399.9, label: "Pouhon", tooltipSide: "right" },
    { number: 11, x: 492.4, y: 401.7, label: "Pouhon", tooltipSide: "left" },
    { number: 12, x: 446.8, y: 505.1, label: "Fagnes", tooltipSide: "right" },
    { number: 13, x: 406.7, y: 501.6, label: "Fagnes", tooltipSide: "left" },
    { number: 14, x: 357.3, y: 561.1, label: "Campus", tooltipSide: "right" },
    { number: 15, x: 308.2, y: 522.6, label: "Stavelot", tooltipSide: "right" },
    { number: 16, x: 436.1, y: 385.2, label: "Courbe Paul Frere", tooltipSide: "right" },
    { number: 17, x: 462.6, y: 316.6, label: "Blanchimont", tooltipSide: "right" },
    { number: 18, x: 426.7, y: 176.7, label: "Bus Stop", tooltipSide: "left" },
    { number: 19, x: 440.9, y: 168.1, label: "Chicane", tooltipSide: "right" },
  ],
  sectors: [
    { id: "sector-1", label: "Sector 1", startPercent: 0, endPercent: 33.3, color: "#e10600" },
    { id: "sector-2", label: "Sector 2", startPercent: 33.3, endPercent: 66.6, color: "#ffffff" },
    { id: "sector-3", label: "Sector 3", startPercent: 66.6, endPercent: 100, color: "#8b949e" },
  ],
  drsZones: [],
  speedTraps: [],
  startFinish: { x: 413, y: 120.2 },
  specs: {
    circuitLengthKm: "7.004",
    laps: 44,
    raceDistanceKm: "308.052",
  },
  source: "Manual Spa-Francorchamps 2026 annotation aligned to FastF1-derived path geometry",
  verified: true,
  note: "2026 Belgian Grand Prix specs from Formula 1. Corner labels are approximate visual annotations aligned to existing track geometry.",
};

const generatedMetadata = generatedCircuitMetadata as Record<string, CircuitMetadataRecord>;

const manualMetadata: Record<string, RaceWeekCircuitMetadata> = {
  monaco: monacoMetadata,
  red_bull_ring: redBullRingMetadata,
  spa: spaMetadata,
};

const cornerNameOverrides: Record<string, Record<string, string>> = {
  catalunya: {
    "1": "Elf",
    "3": "Renault",
    "4": "Repsol",
    "5": "Seat",
    "7": "Wurth",
    "9": "Campsa",
    "10": "La Caixa",
    "12": "Banc Sabadell",
    "13": "Europcar",
    "14": "New Holland",
  },
};

function applyCornerNameOverrides(metadata: RaceWeekCircuitMetadata): RaceWeekCircuitMetadata {
  const overrides = cornerNameOverrides[metadata.circuitId];
  if (!overrides) {
    return metadata;
  }

  return {
    ...metadata,
    corners: metadata.corners.map((corner) => ({
      ...corner,
      label: overrides[String(corner.number)] ?? corner.label,
    })),
    note: "Corner numbers are FastF1-supported visual annotations. Named corners use manually verified public corner-name references where available.",
    verified: true,
  };
}

export function getRaceWeekCircuitMetadata(circuitId: string): RaceWeekCircuitMetadata | null {
  const metadata = manualMetadata[circuitId] ?? generatedMetadata[circuitId];
  if (!metadata || "geometryPending" in metadata) {
    return null;
  }
  return applyCornerNameOverrides(metadata);
}
