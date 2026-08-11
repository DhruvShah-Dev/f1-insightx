import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";
import { listRaceAnalysisIndex } from "@/lib/server/race-analysis-product";
import { listCompletedRaceHistory } from "@/lib/server/race-history";
import { listChampionshipSeasons } from "@/lib/server/standings";

const staticRoutes = [
  { path: "/", priority: 1 },
  { path: "/predictions", priority: 0.95 },
  { path: "/race-analysis", priority: 0.9 },
  { path: "/championship", priority: 0.85 },
  { path: "/lab", priority: 0.7 },
  { path: "/fantasy", priority: 0.7 },
  { path: "/picks", priority: 0.75 },
  { path: "/versus", priority: 0.7 },
  { path: "/privacy", priority: 0.3 },
  { path: "/terms", priority: 0.3 },
  { path: "/cookies", priority: 0.3 },
];

// `lastModified` is only emitted when we have a page-specific timestamp for the
// content (a race date). Stamping every entry with the build time tells crawlers
// the whole site changed on every deploy, which makes the signal worthless.
function entry(path: string, priority: number, lastModified?: Date): MetadataRoute.Sitemap[number] {
  return {
    url: absoluteUrl(path),
    ...(lastModified ? { lastModified } : {}),
    changeFrequency: priority >= 0.9 ? "daily" : priority >= 0.7 ? "weekly" : "monthly",
    priority,
  };
}

function raceDate(value: string | null | undefined) {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes = staticRoutes.map((route) => entry(route.path, route.priority));

  try {
    // Season variants are prerendered path segments, so they belong in the sitemap.
    const seasons = await listChampionshipSeasons();
    routes.push(...seasons.slice(1).map((season) => entry(`/championship/${season}`, 0.6)));
  } catch {
    // The current-season page above still covers standings discovery.
  }

  try {
    const races = await listRaceAnalysisIndex();
    routes.push(...races.map((race) => entry(`/race-analysis/${race.id}`, 0.72, raceDate(race.raceDate))));
    // Archive season filters are prerendered path segments too.
    const analysisSeasons = [...new Set(races.map((race) => race.season))].sort((a, b) => b - a);
    routes.push(...analysisSeasons.slice(1).map((season) => entry(`/race-analysis/season/${season}`, 0.55)));
  } catch {
    // Keep the sitemap available even when generated race-analysis data is absent.
  }

  try {
    const raceHistory = await listCompletedRaceHistory(50);
    routes.push(...raceHistory.map((race) => entry(`/races/${race.id}`, 0.62, raceDate(race.raceDate))));
  } catch {
    // Static routes still provide useful discovery.
  }

  return routes;
}
