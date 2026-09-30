import { createFileRoute } from "@tanstack/react-router";
import { raceReports } from "@/data/season";
import { fallbackWeekendIndex } from "@/lib/f1.fallback";
import { fetchWeekendIndex, SEASON } from "@/lib/f1.server";
import { shouldUseSupabaseProductData } from "@/lib/env.server";
import { SITE_ORIGIN } from "@/lib/seo";

const publicPaths = [
  "/",
  "/raceweek",
  "/analysis",
  "/vs",
  "/championship",
  "/picks",
  "/method",
  "/method/dashboard",
];

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  })[character]!);
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        let completed: Array<{ hasRace: boolean; slug: string | null }> = fallbackWeekendIndex(SEASON).weekends;
        if (shouldUseSupabaseProductData()) {
          try {
            completed = (await fetchWeekendIndex(SEASON)).weekends;
          } catch (error) {
            console.warn("Could not load live sitemap race index; using local reports.", error);
          }
        }
        const paths = [...new Set([
          ...publicPaths,
          ...raceReports.map((race) => `/analysis/${encodeURIComponent(race.slug)}`),
          ...completed.filter((race) => race.hasRace && race.slug).map((race) => `/analysis/${encodeURIComponent(race.slug!)}`),
        ])];
        const entries = paths.map((path) =>
          `  <url><loc>${escapeXml(new URL(path, SITE_ORIGIN).toString())}</loc></url>`,
        );
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>`,
          { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } },
        );
      },
    },
  },
});
