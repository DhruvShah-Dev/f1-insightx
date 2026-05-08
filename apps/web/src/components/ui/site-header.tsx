import Link from "next/link";

type SiteHeaderProps = {
  title: string;
  backHref?: string;
  backLabel?: string;
  actionHref?: string;
  actionLabel?: string;
};

export function SiteHeader({
  title,
  backHref = "/",
  backLabel = "Return home",
  actionHref,
  actionLabel
}: SiteHeaderProps) {
  return (
    <div className="race-week-hero__topbar">
      <Link href={backHref} className="race-week-hero__nav-link">
        {backLabel}
      </Link>
      <div className="race-week-hero__title">{title}</div>
      {actionHref && actionLabel ? (
        <Link href={actionHref} className="race-week-hero__nav-link race-week-hero__nav-link--accent">
          {actionLabel}
        </Link>
      ) : (
        <div />
      )}
    </div>
  );
}
