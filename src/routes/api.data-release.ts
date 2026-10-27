import { createFileRoute } from "@tanstack/react-router";
import { seasonState } from "@/data/season";

export const Route = createFileRoute("/api/data-release")({
  server: {
    handlers: {
      GET: () =>
        Response.json(
          {
            season: seasonState.season,
            resultsThrough: seasonState.resultsThrough,
            raceWeekRound: seasonState.raceWeekRound,
            snapshotISO: seasonState.snapshotISO,
          },
          { headers: { "Cache-Control": "no-store" } },
        ),
    },
  },
});
