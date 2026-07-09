import { getCircuitTrackData } from "@/lib/server/circuit-track-data";
import { RaceWeekCircuitVisualization } from "@/components/race-week/race-week-circuit-visualization";
import { getRaceWeekCircuitMetadata } from "@/lib/ui/race-week-circuit-metadata";

type RaceWeekSectorTrackProps = {
  circuitId: string;
  title: string;
  presentation?: "detailed" | "hero";
  showLegend?: boolean;
  showMetadata?: boolean;
  showSpecs?: boolean;
};

export async function RaceWeekSectorTrack({
  circuitId,
  title,
  presentation,
  showLegend,
  showMetadata,
  showSpecs,
}: RaceWeekSectorTrackProps) {
  const trackData = await getCircuitTrackData(circuitId);

  if (!trackData?.pathData) {
    return (
      <div className="race-week-sector-track race-week-sector-track--empty">
        <span>Track map</span>
        <strong>Geometry unavailable</strong>
      </div>
    );
  }

  return (
    <RaceWeekCircuitVisualization
      title={title}
      trackPath={trackData.pathData}
      metadata={getRaceWeekCircuitMetadata(circuitId)}
      presentation={presentation}
      showLegend={showLegend}
      showMetadata={showMetadata}
      showSpecs={showSpecs}
    />
  );
}
