import Link from "next/link";
import { TrackMap } from "@/components/ui/track-map";
import type { RaceHistorySummary } from "@/lib/server/race-history";

type RaceHistoryCardProps = {
  race: RaceHistorySummary;
};

export async function RaceHistoryCard({ race }: RaceHistoryCardProps) {
  return (
    <Link href={`/races/${race.slug}`} className="race-history-card">
      <div className="race-history-card__visual">
        <TrackMap circuitId={race.circuitId} title={race.circuitName} />
      </div>
      <div className="race-history-card__body">
        <h3>{race.displayName}</h3>
        <p>{race.season}</p>
      </div>
    </Link>
  );
}
