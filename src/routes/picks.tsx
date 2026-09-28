import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PicksExperience } from "@/components/picks-experience";
import { SiteShell } from "@/components/site-shell";
import { getPicksBoard } from "@/lib/f1.functions";

const picksQuery = queryOptions({
  queryKey: ["picks-board"],
  queryFn: () => getPicksBoard({ data: {} }),
  staleTime: 5 * 60_000,
});

export const Route = createFileRoute("/picks")({
  loader: ({ context }) => context.queryClient.ensureQueryData(picksQuery),
  head: () => ({
    meta: [
      { title: "Picks - F1 InsightX" },
      { name: "description", content: "Pick drivers each race weekend and earn points for accurate predictions." },
      { property: "og:title", content: "Picks - F1 InsightX" },
      { property: "og:description", content: "Choose race, qualifying, and bonus picks. Earn points for every correct call." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: ({ error }) => <SiteShell><p role="alert">Picks unavailable: {error.message}</p></SiteShell>,
  component: Picks,
});

function Picks() {
  const { data } = useSuspenseQuery(picksQuery);
  return <PicksExperience data={data} />;
}
