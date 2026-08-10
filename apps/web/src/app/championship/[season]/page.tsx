import { notFound } from "next/navigation";
import { listChampionshipSeasons } from "@/lib/server/standings";
import { makeMetadata } from "@/lib/seo";
import { ChampionshipView } from "../page";

// Season variants live on their own path so each one prerenders. See the note on
// ChampionshipView: the previous `?season=` query param made /championship a
// dynamic render, which forced `Cache-Control: private, no-store` and put a
// multi-second uncached render in front of every visitor.
export const revalidate = 900;

type ChampionshipSeasonPageProps = {
  params: Promise<{ season: string }>;
};

export async function generateStaticParams() {
  const seasons = await listChampionshipSeasons();
  // The newest season is served by /championship itself, so it is not duplicated here.
  return seasons.slice(1).map((season) => ({ season: String(season) }));
}

export async function generateMetadata({ params }: ChampionshipSeasonPageProps) {
  const { season } = await params;
  return makeMetadata({
    title: `${season} Championship Standings`,
    description: `Formula 1 ${season} driver and constructor championship standings with team form, points gaps, and season performance leaders.`,
    path: `/championship/${season}`,
    keywords: [
      `F1 ${season} standings`,
      `F1 ${season} championship`,
      "F1 driver standings",
      "F1 constructor standings",
    ],
  });
}

export default async function ChampionshipSeasonPage({ params }: ChampionshipSeasonPageProps) {
  const { season } = await params;
  const parsed = Number(season);
  const seasons = await listChampionshipSeasons();

  if (!Number.isInteger(parsed) || !seasons.includes(parsed)) {
    notFound();
  }

  return <ChampionshipView season={parsed} />;
}
