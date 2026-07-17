import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { PicksCountdown } from "@/components/pit-wall-picks/picks-countdown";
import { PitWallPicksWorkspace } from "@/components/pit-wall-picks/pit-wall-picks-workspace";
import { AssetImage } from "@/components/ui/asset-image";
import { SiteFooter } from "@/components/ui/site-footer";
import { StatePanel } from "@/components/ui/state-panel";
import { getSupabaseServerClient } from "@/lib/auth/supabase-server";
import { getServerEnv } from "@/lib/env";
import { getPitWallPicksPayload } from "@/lib/server/pit-wall-picks";
import { getCurrentDriverMeta, getDriverImagePath } from "@/lib/ui/driver-asset-manifest";
import { getTeamAsset } from "@/lib/ui/asset-manifest";

export const metadata: Metadata = {
  title: "Picks | F1 InsightX",
};

function formatRaceDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "Race date pending";
  }
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

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

  const heroDrivers = payload.drivers.slice(0, 3).map((driver) => {
    const driverMeta = getCurrentDriverMeta(driver.id);
    const team = getTeamAsset(driverMeta.teamId);
    return { driver, driverMeta, team };
  });
  const primaryTeam = heroDrivers[0]?.team ?? getTeamAsset(null);

  return (
    <main
      className="subpage-shell pit-wall-page"
      style={
        {
          "--pit-team-primary": primaryTeam.primary,
          "--pit-team-secondary": primaryTeam.secondary,
          "--pit-team-accent": primaryTeam.accent,
        } as CSSProperties
      }
    >
      <section className="pit-wall-hero">
        <div className="race-cinema-atmosphere pit-wall-hero__atmosphere" aria-hidden="true">
          {primaryTeam.carImagePath ? (
            <AssetImage
              src={primaryTeam.carImagePath}
              fallbackSrc={primaryTeam.fallbackImagePath}
              alt=""
              className="race-cinema-atmosphere__car"
              fill
              priority
              sizes="100vw"
              style={{ objectPosition: primaryTeam.imagePosition, objectFit: primaryTeam.imageFit ?? "cover" }}
            />
          ) : null}
          <div className="race-cinema-atmosphere__grid" />
          <div className="race-cinema-atmosphere__speed" />
        </div>

        <div className="pit-wall-hero__content">
          <div className="pit-wall-hero__copy">
            <p className="pit-wall-hero__eyebrow">Pit Wall Picks / {payload.race.raceName}</p>
            <h1>Race picks</h1>
            <p className="pit-wall-hero__deck">
              Set the qualifying order, race podium, and bonus calls before the session locks. Picks are for entertainment only, with no wagers, cash prizes, or monetary value.
            </p>
            <div className="pit-wall-hero__actions">
              <a href={user ? "#race-card" : "#sign-in"} className="pit-wall-hero__cta">
                {user ? "Open race card" : "Sign in to play"}
              </a>
              <span className="pit-wall-hero__status">{payload.lockStatusLabel}</span>
            </div>
          </div>

          <div className="pit-wall-hero__race">
            <span>Race date</span>
            <strong>{formatRaceDate(payload.race.scheduledAt)}</strong>
            <em>
              Round {payload.race.round} / {payload.race.season}
            </em>
          </div>

          <PicksCountdown lockAt={payload.challenge.qualifyingLockAt} />
        </div>

        <div className="pit-wall-hero__visual" aria-hidden="true">
          <div className="pit-wall-hero__beam" />
          <div className="pit-wall-hero__chip-rail">
            <i>Q3</i>
            <i>P1</i>
            <i>SC</i>
            <i>DRS</i>
          </div>
          <div className="pit-wall-hero__driver-stack">
            {heroDrivers.map(({ driver, driverMeta, team }, index) => (
              <div
                className={`pit-wall-hero__driver pit-wall-hero__driver--${index + 1}`}
                key={driver.id}
                style={
                  {
                    "--driver-team-primary": team.primary,
                    "--driver-team-secondary": team.secondary,
                  } as CSSProperties
                }
              >
                <AssetImage
                  src={getDriverImagePath(driverMeta, "body")}
                  fallbackSrc={driverMeta.fallbackPhotoPath}
                  alt=""
                  className="pit-wall-hero__driver-image"
                  fill
                  priority={index === 0}
                  sizes="(max-width: 760px) 45vw, 24vw"
                  style={{
                    objectFit: driverMeta.photoFit ?? "contain",
                    objectPosition: driverMeta.photoPosition ?? "center bottom",
                    transform: `translateX(${driverMeta.photoTranslateX ?? 0}px) scale(${driverMeta.photoScale ?? 1})`,
                  }}
                />
                <span>{driver.code ?? driverMeta.driverCode}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {!user ? (
        <section className="pit-wall-auth-gate" id="sign-in">
          <div className="pit-wall-auth-gate__copy">
            <span>Race card access</span>
            <h2>Sign in to lock picks</h2>
            <p>Your picks stay private until scoring opens after the race data lands. No purchase, wager, or prize is involved.</p>
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
