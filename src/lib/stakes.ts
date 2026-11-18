type QualifyingPosition = {
  code: string;
  name: string;
  position: number | null;
};

type GridPosition = {
  code: string;
  name: string;
  grid: number | null;
};

const recordedPosition = (value: number | null | undefined) =>
  value != null && value > 0 ? value : null;

export function buildStakesFocus(
  qualifying: QualifyingPosition[],
  grid: GridPosition[],
): { code: string | null; question: string } {
  const gridByCode = new Map(grid.map((driver) => [driver.code, driver]));
  const changes = qualifying.flatMap((driver) => {
    const quali = recordedPosition(driver.position);
    const start = recordedPosition(gridByCode.get(driver.code)?.grid);
    return quali != null && start != null && quali !== start
      ? [{ code: driver.code, name: driver.name, quali, start, change: Math.abs(start - quali) }]
      : [];
  }).sort((a, b) => b.change - a.change || a.quali - b.quali || a.code.localeCompare(b.code));

  const changed = changes[0];
  if (changed) {
    return {
      code: changed.code,
      question: changed.start > changed.quali
        ? `Can ${changed.name} recover from a P${changed.start} start after qualifying P${changed.quali}?`
        : `Can ${changed.name} make the most of a P${changed.start} start after qualifying P${changed.quali}?`,
    };
  }

  const pole = qualifying
    .filter((driver) => recordedPosition(driver.position) != null)
    .sort((a, b) => a.position! - b.position! || a.code.localeCompare(b.code))[0];
  if (pole) return { code: pole.code, question: `Can ${pole.name} turn pole into a win?` };

  const firstGrid = grid
    .filter((driver) => recordedPosition(driver.grid) != null)
    .sort((a, b) => a.grid! - b.grid! || a.code.localeCompare(b.code))[0];
  if (firstGrid) return { code: firstGrid.code, question: "What did the starting grid set up?" };

  return { code: qualifying[0]?.code ?? grid[0]?.code ?? null, question: "What was at stake before lights out?" };
}
