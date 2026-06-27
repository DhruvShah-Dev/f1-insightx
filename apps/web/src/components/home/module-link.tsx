import Link from "next/link";
import { TeamCarCard } from "@/components/ui/team-car-card";

type ModuleLinkProps = {
  href: string;
  index: string;
  title: string;
  summary: string;
  visualTeamId?: string;
  variant: "feature" | "band" | "compact";
};

export function ModuleLink({
  href,
  index,
  title,
  summary,
  visualTeamId,
  variant,
}: ModuleLinkProps) {
  return (
    <Link href={href} className={`module-link module-link--${variant}`}>
      <div className="module-link__header">
        <span>{index}</span>
      </div>
      <h3 className="module-link__title">{title}</h3>
      <p className="module-link__summary">{summary}</p>
      <svg className="module-link__arrow" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 12h13M13 6l6 6-6 6" />
      </svg>
      {visualTeamId ? (
        <div className="module-link__media">
          <TeamCarCard
            teamId={visualTeamId}
            title={title}
            subtitle="Team media"
            compact
            priority={variant === "feature"}
          />
        </div>
      ) : null}
    </Link>
  );
}
