export type StrategyStint = {
  code: string;
  stint: number;
  compound: string | null;
  startLap: number | null;
  endLap: number | null;
  length: number | null;
  medianS: number | null;
  note: string | null;
};

export type StrategyPit = {
  code: string;
  stop: number;
  lap: number | null;
  lossS: number | null;
  confidence: number | null;
  weakestAssumption: string | null;
};

export type StrategyRecordedPit = {
  id: string;
  code: string;
  lap: number;
  timestampUtc: string;
  detail: string;
  source: string;
  limitation: string | null;
};

export type StrategyStatus = {
  id: string;
  startLap: number;
  endLap: number;
  label: string;
  source: string;
  limitation: string | null;
};

export type StrategyCandidate = {
  lap: number;
  rivalPit: StrategyRecordedPit | null;
  status: StrategyStatus | null;
};

export function selectStrategyStint(stints: StrategyStint[], key: string | undefined, a: string | null, b: string | null) {
  const eligible = stints.filter((row) => row.code === a || row.code === b);
  const selected = key?.match(/^([A-Z]{3})-(\d{1,2})$/i);
  if (selected) {
    const match = eligible.find((row) => row.code === selected[1]!.toUpperCase() && row.stint === Number(selected[2]));
    if (match) return match;
  }
  const preferred = eligible.filter((row) => row.code === a).sort((x, y) => x.stint - y.stint);
  return preferred.find((row) => row.stint > 1) ?? preferred[0] ?? eligible.sort((x, y) => x.stint - y.stint)[0] ?? null;
}

export function recordedStopForStint(stint: StrategyStint, pits: StrategyRecordedPit[]) {
  if (stint.stint < 2 || stint.startLap == null) return null;
  return pits.find((pit) => pit.code === stint.code && pit.lap === stint.startLap! - 1) ?? null;
}

export function estimatedCycleForStint(stint: StrategyStint, pits: StrategyPit[]) {
  if (stint.stint < 2 || stint.startLap == null) return null;
  return pits.find((pit) => pit.code === stint.code && pit.stop === stint.stint - 1 && pit.lap === stint.startLap! - 1) ?? null;
}

export function alternativeTimingCandidates(
  actualStop: StrategyRecordedPit | null,
  rivalCode: string | null,
  pits: StrategyRecordedPit[],
  statuses: StrategyStatus[],
): StrategyCandidate[] {
  if (!actualStop) return [];
  const byLap = new Map<number, StrategyCandidate>();
  const candidate = (lap: number) => {
    if (lap < 1 || lap === actualStop.lap || Math.abs(lap - actualStop.lap) > 3) return null;
    const existing = byLap.get(lap) ?? { lap, rivalPit: null, status: null };
    byLap.set(lap, existing);
    return existing;
  };
  for (const pit of pits) {
    if (pit.code !== rivalCode) continue;
    const row = candidate(pit.lap);
    if (row && !row.rivalPit) row.rivalPit = pit;
  }
  for (const status of statuses) {
    if (status.label !== "safety-car" && status.label !== "virtual-safety-car") continue;
    for (let lap = Math.max(status.startLap, actualStop.lap - 3); lap <= Math.min(status.endLap, actualStop.lap + 3); lap++) {
      const row = candidate(lap);
      if (row && !row.status) row.status = status;
    }
  }
  return [...byLap.values()].sort((x, y) => Math.abs(x.lap - actualStop.lap) - Math.abs(y.lap - actualStop.lap) || x.lap - y.lap);
}
