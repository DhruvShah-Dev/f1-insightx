export type ZandvoortCorner = {
  number: number;
  name: string;
  x: number;
  y: number;
  sector: 1 | 2 | 3;
  tooltipSide?: "left" | "right" | "above" | "below";
};

// Marker positions are FastF1 circuit_info annotations aligned to the local
// FastF1-derived Zandvoort path. Names are manually verified against
// https://www.circuitzandvoort.nl/en/corners/.
export const ZANDVOORT_CORNERS: ZandvoortCorner[] = [
  { number: 1, name: "Tarzanbocht", x: 360.5, y: 35.1, sector: 1, tooltipSide: "below" },
  { number: 2, name: "Gerlachbocht", x: 342.2, y: 224.7, sector: 1, tooltipSide: "right" },
  { number: 3, name: "Hugenholtzbocht", x: 273.3, y: 292.6, sector: 1, tooltipSide: "left" },
  { number: 4, name: "Hunserug", x: 405.1, y: 277.9, sector: 1, tooltipSide: "above" },
  { number: 5, name: "Slotemakerbocht", x: 527.3, y: 289.2, sector: 1, tooltipSide: "above" },
  { number: 6, name: "Scheivlak", x: 623.3, y: 245.5, sector: 1, tooltipSide: "above" },
  { number: 7, name: "Scheivlak", x: 800.8, y: 287.9, sector: 2, tooltipSide: "left" },
  { number: 8, name: "Mastersbocht", x: 712.3, y: 471.5, sector: 2, tooltipSide: "left" },
  { number: 9, name: "Turn 9", x: 589.9, y: 422.9, sector: 2, tooltipSide: "below" },
  { number: 10, name: "Turn 10", x: 720.1, y: 338.4, sector: 2, tooltipSide: "left" },
  { number: 11, name: "Hans Ernst Chicane", x: 358.6, y: 376.3, sector: 2, tooltipSide: "right" },
  { number: 12, name: "Hans Ernst Chicane", x: 308.6, y: 368.2, sector: 2, tooltipSide: "left" },
  { number: 13, name: "Turn 13", x: 327, y: 566.6, sector: 3, tooltipSide: "right" },
  { number: 14, name: "Arie Luyendykbocht", x: 166, y: 534.3, sector: 3, tooltipSide: "right" },
];
