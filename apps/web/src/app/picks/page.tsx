import type { Metadata } from "next";
import Link from "next/link";
import { PicksCountdown } from "@/components/pit-wall-picks/picks-countdown";
import { PitWallPicksWorkspace } from "@/components/pit-wall-picks/pit-wall-picks-workspace";
import { SiteFooter } from "@/components/ui/site-footer";
import { StatePanel } from "@/components/ui/state-panel";
import { getSupabaseServerClient } from "@/lib/auth/supabase-server";
import { getServerEnv } from "@/lib/env";
import { getPitWallPicksPayload } from "@/lib/server/pit-wall-picks";

export const metadata: Metadata = {
  title: "Picks | F1 InsightX",
};

export default async function PicksPage() {
  const { hasSupabaseAuth } = getServerEnv();
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const payload = await getPitWallPicksPayload(user?.id ?? null);

  if (!payload.configured || !payload.race || !payload.challenge) {
    return (
      <main className="subpage-shell pit-wall-page">
        <StatePanel
          title="Picks are being prepared."
          message="Next race soon."
          tone="notice"
          actionHref="/predictions"
          actionLabel="Race Week"
        />
        <SiteFooter />
      </main>
    );
  }

  return (
    <main className="subpage-shell pit-wall-page">
      <section className="pit-wall-hero">
        <div className="pit-wall-hero__copy">
          <span>{payload.race.raceName}</span>
          <h1>Picks</h1>
        </div>
        <PicksCountdown lockAt={payload.challenge.qualifyingLockAt} />
      </section>

      {!user ? (
        <section className="pit-wall-auth-gate">
          <div className="pit-wall-auth-gate__copy">
            <span>Locked table</span>
            <h2>Sign in to lock picks</h2>
          </div>
          <div className="pit-wall-auth-gate__panel">
            <span>Account</span>
            <strong>{hasSupabaseAuth ? "Ready" : "Offline"}</strong>
            {hasSupabaseAuth ? (
              <Link href="/account" className="pit-wall-submit">
                Sign in
              </Link>
            ) : (
              <p>Unavailable</p>
            )}
          </div>
        </section>
      ) : (
        <PitWallPicksWorkspace
          raceId={payload.race.id}
          isLocked={payload.isLocked}
          persistenceAvailable={payload.persistenceAvailable}
          randomPositions={payload.challenge.randomPositions}
          drivers={payload.drivers}
          userPick={payload.userPick}
          userScore={payload.userScore}
          raceLeaderboard={payload.raceLeaderboard}
          overallLeaderboard={payload.overallLeaderboard}
          raceHistory={payload.raceHistory}
        />
      )}

      <SiteFooter />
    </main>
  );
}
