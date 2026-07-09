import { DriverVersusWorkspace } from "@/components/versus/driver-versus-workspace";
import {
  getAnalyticsComparison,
  getAnalyticsDefaultDriverPair,
  getAnalyticsDrivers,
  listAnalyticsSessions,
  type AnalyticsCompareMode,
} from "@/lib/server/analytics-product";

type VersusPageProps = {
  searchParams: Promise<{
    sessionId?: string;
    driverA?: string;
    driverB?: string;
  }>;
};

export const metadata = {
  title: "Driver vs Driver | F1 InsightX",
  description: "Interactive Formula 1 driver comparison across braking, straight-line speed, traction, and energy proxy signals.",
};

export default async function VersusPage({ searchParams }: VersusPageProps) {
  const params = await searchParams;
  const sessions = await listAnalyticsSessions();
  const requestedSession = params.sessionId?.trim();
  const sessionId = sessions.some((session) => session.id === requestedSession)
    ? requestedSession as string
    : sessions[0]?.id ?? "";
  const drivers = sessionId ? await getAnalyticsDrivers(sessionId) : [];
  const defaultPair = sessionId ? await getAnalyticsDefaultDriverPair(sessionId) : null;
  const driverA = params.driverA?.trim().toUpperCase() || defaultPair?.driverA || drivers[0]?.code || "";
  const driverB = params.driverB?.trim().toUpperCase()
    || defaultPair?.driverB
    || drivers.find((driver) => driver.code !== driverA)?.code
    || "";
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
