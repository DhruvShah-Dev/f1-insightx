import { notFound } from "next/navigation";
import { RaceAnalysisIndexView } from "../../index-view";
import { listRaceAnalysisIndex } from "@/lib/server/race-analysis-product";
import { makeMetadata } from "@/lib/seo";

export const revalidate = 900;

async function seasonList() {
  const races = await listRaceAnalysisIndex();
  return [...new Set(races.map((race) => race.season))].sort((a, b) => b - a);
}

export async function generateStaticParams() {
  const seasons = await seasonList();
  return seasons.map((season) => ({ season: String(season) }));
}

export async function generateMetadata({ params }: { params: Promise<{ season: string }> }) {
  const { season } = await params;
  return makeMetadata({
    title: `${season} Race Analysis`,
    description: `Formula 1 ${season} post-race analysis reports: winners, podiums, strategy shape, pit impact, position movement, and pace evolution.`,
    path: `/race-analysis/season/${season}`,
    keywords: [`F1 ${season} race analysis`, "F1 strategy analysis", "F1 race reports"],
  });
}

export default async function RaceAnalysisSeasonPage({ params }: { params: Promise<{ season: string }> }) {
  const { season } = await params;
  const parsed = Number(season);
  const seasons = await seasonList();
  if (!Number.isFinite(parsed) || !seasons.includes(parsed)) {
    notFound();
  }
  return <RaceAnalysisIndexView season={parsed} />;
}
