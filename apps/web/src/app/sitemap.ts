import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";
import { listRaceAnalysisIndex } from "@/lib/server/race-analysis-product";
import { listCompletedRaceHistory } from "@/lib/server/race-history";

const staticRoutes = [
  { path: "/", priority: 1 },
  { path: "/predictions", priority: 0.95 },
  { path: "/race-analysis", priority: 0.9 },
  { path: "/championship", priority: 0.85 },
  { path: "/picks", priority: 0.75 },
  { path: "/versus", priority: 0.7 },
  { path: "/privacy", priority: 0.3 },
  { path: "/terms", priority: 0.3 },
  { path: "/cookies", priority: 0.3 },
];

function entry(path: string, priority: number, lastModified = new Date()): MetadataRoute.Sitemap[number] {
  return {
    url: absoluteUrl(path),
    lastModified,
    changeFrequency: priority >= 0.9 ? "daily" : priority >= 0.7 ? "weekly" : "monthly",
    priority,
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes = staticRoutes.map((route) => entry(route.path, route.priority));

  try {
    const races = await listRaceAnalysisIndex();
    routes.push(
      ...races.map((race) => entry(`/race-analysis/${race.id}`, 0.72, race.raceDate ? new Date(race.raceDate) : new Date())),
    );
  } catch {
    // Keep the sitemap available even when generated race-analysis data is absent.
  }

  try {
    const raceHistory = await listCompletedRaceHistory(50);
    routes.push(
      ...raceHistory.map((race) => entry(`/races/${race.id}`, 0.62, race.raceDate ? new Date(race.raceDate) : new Date())),
    );
  } catch {
    // Static routes still provide useful discovery.
  }

  return routes;
}
