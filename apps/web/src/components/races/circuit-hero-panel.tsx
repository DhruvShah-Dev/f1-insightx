import { TrackMap } from "@/components/ui/track-map";
import { getCircuitGeoFallback } from "@/lib/server/circuit-geojson";
import type { RaceDetail } from "@/lib/server/race-history";
import { getCircuitAsset } from "@/lib/ui/asset-manifest";

type CircuitHeroPanelProps = {
  detail: RaceDetail;
};

export async function CircuitHeroPanel({ detail }: CircuitHeroPanelProps) {
  const circuitAsset = getCircuitAsset(detail.circuitId);
  const geoFallback = await getCircuitGeoFallback(detail.circuitId);
  const numberOfLaps =
    detail.classification.find((entry) => entry.position === 1)?.lapsCompleted ??
    detail.classification.reduce<number | null>((max, entry) => {
      if (entry.lapsCompleted === null) {
        return max;
      }
      if (max === null) {
        return entry.lapsCompleted;
      }
      return Math.max(max, entry.lapsCompleted);
    }, null);

  const circuitLength = geoFallback?.lengthKm ?? null;
  const raceDistance = circuitLength && numberOfLaps ? Number((circuitLength * numberOfLaps).toFixed(3)) : null;
  const lapRecordMeta =
    circuitAsset.lapRecordDriver && circuitAsset.lapRecordYear
      ? `${circuitAsset.lapRecordDriver} (${circuitAsset.lapRecordYear})`
      : detail.fastestLap
        ? `${detail.fastestLap.driverName} (${detail.season})`
        : "Unavailable";
  const raceDate = new Date(detail.raceDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <section className="circuit-hero">
      <div className="circuit-hero__topbar">
        <span>Round {detail.round}</span>
        <span>{raceDate}</span>
        <strong>{detail.displayName}</strong>
      </div>

      <div className="circuit-hero__body">
        <div className="circuit-hero__visual">
          <div className="circuit-hero__visual-frame">
            <TrackMap circuitId={detail.circuitId} title={detail.circuit.name} variant="hero" />
          </div>
        </div>

        <aside className="circuit-hero__stats">
          <div className="circuit-hero__stats-heading">
            <p className="workspace-panel__eyebrow">Circuit stats</p>
            <h2>{detail.circuit.name}</h2>
            <p>
              {detail.circuit.location ? `${detail.circuit.location}, ` : ""}
              {detail.circuit.country ?? "Location unavailable"}
            </p>
          </div>

          <div className="circuit-hero__stats-grid">
            <CircuitStat label="Circuit Length" value={circuitLength ? `${circuitLength.toFixed(3)} km` : "Unavailable"} />
            <CircuitStat label="First Grand Prix" value={geoFallback?.firstGrandPrix ? String(geoFallback.firstGrandPrix) : "Unavailable"} />
            <CircuitStat label="Number of Laps" value={numberOfLaps ? String(numberOfLaps) : "Unavailable"} />
            <CircuitStat label="Fastest Lap Time" value={circuitAsset.lapRecordTime ?? "Unavailable"} />
            <CircuitStat label="Fastest Lap Driver + Year" value={lapRecordMeta} />
            <CircuitStat label="Race Distance" value={raceDistance ? `${raceDistance.toFixed(3)} km` : "Unavailable"} />
          </div>
        </aside>
      </div>
    </section>
  );
}

function CircuitStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="circuit-hero__stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
