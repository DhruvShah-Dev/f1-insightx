import Link from "next/link";
import { TeamCarCard } from "@/components/ui/team-car-card";

type ModuleLinkProps = {
  href: string;
  index: string;
  title: string;
  summary: string;
  state: string;
  visualTeamId?: string;
};

export function ModuleLink({
  href,
  index,
  title,
  summary,
  state,
  visualTeamId,
}: ModuleLinkProps) {
  return (
    <Link href={href} className="module-link">
      <div className="module-link__header">
        <span>{index}</span>
        <span>{state}</span>
      </div>
      <h3 className="module-link__title">{title}</h3>
      <p className="module-link__summary">{summary}</p>
      {visualTeamId ? (
        <div className="module-link__media">
          <TeamCarCard
            teamId={visualTeamId}
            title={title}
            subtitle="Team media"
            compact
          />
        </div>
      ) : null}
    </Link>
  );
}
