import { RaceAnalysisIndexView } from "./index-view";
import { makeMetadata } from "@/lib/seo";

// Public analytics page: the offline pipeline refreshes source data at most a few
// times per race weekend, so serve a cached render and revalidate in the
// background instead of rebuilding on every request.
export const revalidate = 900;

export const metadata = makeMetadata({
  title: "Race Analysis",
  description:
    "Browse Formula 1 post-race analysis reports covering winners, podiums, strategy shape, pit impact, position movement, and pace evolution.",
  path: "/race-analysis",
  keywords: ["F1 race analysis", "F1 strategy analysis", "F1 race reports"],
});

export default async function RaceAnalysisIndexPage() {
  return <RaceAnalysisIndexView />;
}
