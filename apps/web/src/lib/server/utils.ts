export function roundTo(value: number, digits: number) {
  return Number(value.toFixed(digits));
}

export function groupBy<T>(items: T[], key: (item: T) => string) {
  const map = new Map<string, T[]>();

  for (const item of items) {
    const groupKey = key(item);
    const group = map.get(groupKey);
    if (group) {
      group.push(item);
    } else {
      map.set(groupKey, [item]);
    }
  }

  return map;
}

export function compareSeasonRoundDesc(
  left: { season: number; round: number },
  right: { season: number; round: number },
) {
  const seasonDelta = right.season - left.season;
  if (seasonDelta !== 0) {
    return seasonDelta;
  }

  return right.round - left.round;
}
