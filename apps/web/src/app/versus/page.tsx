import { DriverVersusWorkspace } from "@/components/versus/driver-versus-workspace";
import {
  getAnalyticsComparison,
  getAnalyticsDefaultDriverPair,
  getAnalyticsDrivers,
  listAnalyticsSessions,
  type AnalyticsCompareMode,
} from "@/lib/server/analytics-product";
import { makeMetadata } from "@/lib/seo";

// Public analytics page: the offline pipeline refreshes source data at most a few
// times per race weekend, so serve a cached render and revalidate in the
// background instead of rebuilding on every request.
export const revalidate = 900;

export const metadata = makeMetadata({
  title: "Driver vs Driver",
  description:
    "Interactive Formula 1 driver comparison across braking, straight-line speed, traction, and energy proxy telemetry signals.",
  path: "/versus",
  keywords: ["F1 driver comparison", "F1 telemetry comparison", "Formula 1 telemetry"],
});

// No query params are read here on purpose: reading them server-side forces a
// dynamic render on every request. Session and driver selection already lives in
// the client workspace, which fetches comparisons through the API route.
export default async function VersusPage() {
  const sessions = await listAnalyticsSessions();
  const sessionId = sessions[0]?.id ?? "";
  const drivers = sessionId ? await getAnalyticsDrivers(sessionId) : [];
  const defaultPair = sessionId ? await getAnalyticsDefaultDriverPair(sessionId) : null;
  const driverA = defaultPair?.driverA || drivers[0]?.code || "";
  const driverB = defaultPair?.driverB && defaultPair.driverB !== driverA
    ? defaultPair.driverB
    : drivers.find((driver) => driver.code !== driverA)?.code || "";
  const mode: AnalyticsCompareMode = "all";
  const comparison = sessionId && driverA && driverB && driverA !== driverB
    ? await getAnalyticsComparison(sessionId, driverA, driverB, mode)
    : null;

  return (
    <main className="versus-page">
      <DriverVersusWorkspace
        sessions={sessions}
        initialDrivers={drivers}
        initialComparison={comparison}
      />
    </main>
  );
}
