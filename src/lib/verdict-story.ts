export type VerdictDriver = {
  code: string; name: string; grid: number | null; finish: number | null;
  status: string | null; points: number | null;
};

export function verdictResult(row: VerdictDriver | undefined) {
  if (!row) return { gridLabel: "Unavailable", finishLabel: "Unavailable", change: null, changeLabel: "Unavailable", plotFinish: null };
  const grid = row.grid != null && row.grid > 0 ? row.grid : null;
  const finish = row.finish != null && row.finish > 0 ? row.finish : null;
  const status = row.status?.trim().toLowerCase() ?? "";
  const classified = status === "finished" || status === "lapped";
  const change = grid != null && finish != null && classified ? grid - finish : null;
  return {
    gridLabel: grid == null ? row.grid === 0 ? "Pit-lane start" : "Grid unavailable" : `P${grid}`,
    finishLabel: finish == null ? row.status || "Unavailable" : classified ? `P${finish}` : `${row.status || "Unclassified"} · P${finish} in official order`,
    change,
    changeLabel: change == null ? "Not comparable" : change > 0 ? `+${change} gained` : change < 0 ? `${Math.abs(change)} lost` : "No change",
    plotFinish: classified ? finish : null,
  };
}

export function verdictSentence(row: VerdictDriver | undefined): string {
  if (!row) return "A selected driver has no official result.";
  const result = verdictResult(row);
  if (result.change != null) {
    return `${row.name} started ${result.gridLabel} and finished ${result.finishLabel}, ${result.change === 0 ? "with no change in position" : result.change > 0 ? `gaining ${result.change} ${result.change === 1 ? "place" : "places"}` : `losing ${Math.abs(result.change)} ${result.change === -1 ? "place" : "places"}`}.`;
  }
  if (row.status && row.status.toLowerCase() !== "finished" && row.status.toLowerCase() !== "lapped") {
    return `${row.name} started ${result.gridLabel} and ${row.status.toLowerCase()}; the official order lists ${row.finish == null ? "no finishing place" : `P${row.finish}`}.`;
  }
  return `${row.name}: ${result.gridLabel} to ${result.finishLabel}. A places change cannot be calculated.`;
}
