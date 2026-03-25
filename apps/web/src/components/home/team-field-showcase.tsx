import { TeamCarCard } from "@/components/ui/team-car-card";
import { CURRENT_2026_TEAM_IDS, getTeamAsset } from "@/lib/ui/asset-manifest";

export function TeamFieldShowcase() {
  return (
    <section className="team-showcase">
      <div className="section-shell">
        <div className="section-meta">Supporting context</div>
        <h2 className="section-title">Constructor field.</h2>
        <p className="section-copy">
          Every current team, rendered through one asset system with consistent car and color identity.
        </p>
      </div>

      <div className="team-showcase__grid" aria-label="2026 Formula 1 constructors">
        {CURRENT_2026_TEAM_IDS.map((teamId, index) => {
          const team = getTeamAsset(teamId);

          return (
            <TeamCarCard
              key={team.id}
              teamId={team.id}
              title={team.label}
              subtitle="2026 challenger"
              showMeta
              priority={index < 1}
            />
          );
        })}
      </div>
    </section>
  );
}
