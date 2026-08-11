import { RaceWeekView } from "./race-week-view";
import { makeMetadata } from "@/lib/seo";

// Public analytics page: the offline pipeline refreshes source data at most a few
// times per race weekend, so serve a cached render and revalidate in the
// background instead of rebuilding on every request.
export const revalidate = 900;

export const metadata = makeMetadata({
  title: "Race Week",
  description:
    "Formula 1 race week hub: session schedule in track or local time, qualifying projections, weather risk, session readiness, and circuit context.",
  path: "/raceweek",
  keywords: ["F1 race week", "Formula 1 session times", "F1 qualifying predictions"],
});

export default async function RaceWeekPage() {
  return <RaceWeekView mode="baseline" />;
}
