import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PicksExperience } from "@/components/picks-experience";
import { SiteShell } from "@/components/site-shell";
import { getPicksBoard } from "@/lib/f1.functions";
import { pageSeo } from "@/lib/seo";

const picksQuery = queryOptions({
  queryKey: ["picks-board"],
  queryFn: () => getPicksBoard({ data: {} }),
  staleTime: 5 * 60_000,
});

export const Route = createFileRoute("/picks")({
  loader: ({ context }) => context.queryClient.ensureQueryData(picksQuery),
  head: () => pageSeo({
    title: "F1 Picks: Make Race Weekend Predictions | F1 InsightX",
    description: "Choose qualifying, race and bonus picks for each Formula 1 weekend and track your prediction points.",
    path: "/picks",
  }),
  errorComponent: ({ error }) => <SiteShell><p role="alert">Picks unavailable: {error.message}</p></SiteShell>,
  component: Picks,
});

function Picks() {
  const { data } = useSuspenseQuery(picksQuery);
  return <PicksExperience data={data} />;
}
