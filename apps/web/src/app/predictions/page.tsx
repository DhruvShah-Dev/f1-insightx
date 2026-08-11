import { PredictionsView } from "./predictions-view";
import { makeMetadata } from "@/lib/seo";

// Public analytics page: the offline pipeline refreshes source data at most a few
// times per race weekend, so serve a cached render and revalidate in the
// background instead of rebuilding on every request.
export const revalidate = 900;

export const metadata = makeMetadata({
  title: "Race Week Predictions",
  description:
    "Formula 1 race-week predictions with qualifying projections, weather risk, session readiness, circuit context, and live practice signal quality.",
  path: "/predictions",
  keywords: ["F1 predictions", "Formula 1 race week", "F1 qualifying predictions"],
});

export default async function PredictionsPage() {
  return <PredictionsView mode="baseline" />;
}
