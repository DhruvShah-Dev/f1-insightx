// Permanent car numbers keyed by three-letter driver code.
// The `drivers` table only stores `permanent_number` for a handful of entries,
// so this map covers the current and recent grid. Codes with no known number
// fall back to showing the code on the helmet instead of inventing a digit.

const NUMBERS: Record<string, number> = {
  VER: 1,
  SAR: 2,
  RIC: 3,
  NOR: 4,
  BOR: 5,
  HAD: 6,
  DOO: 7,
  GAS: 10,
  PER: 11,
  ANT: 12,
  ALO: 14,
  LEC: 16,
  BIA: 17,
  STR: 18,
  MAG: 20,
  TSU: 22,
  ALB: 23,
  ZHO: 24,
  HUL: 27,
  LAW: 30,
  OCO: 31,
  COL: 43,
  HAM: 44,
  SAI: 55,
  RUS: 63,
  BOT: 77,
  PIA: 81,
  BEA: 87,
  AIT: 89,
};

export function driverNumber(code: string | null | undefined): number | null {
  if (!code) return null;
  return NUMBERS[code.toUpperCase()] ?? null;
}
