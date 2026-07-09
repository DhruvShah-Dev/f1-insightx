import Link from "next/link";

type ModuleLinkProps = {
  href: string;
  index: string;
  title: string;
  summary: string;
  icon: "analysis" | "championship" | "forecast" | "picks" | "strategy";
  variant: "feature" | "band" | "compact";
};

export function ModuleLink({
  href,
  index,
  title,
  summary,
  icon,
  variant,
}: ModuleLinkProps) {
  return (
    <Link href={href} className={`module-link module-link--${variant}`}>
      <div className="module-link__header">
        <span>{index}</span>
        <ProductIcon icon={icon} />
      </div>
      <h3 className="module-link__title">{title}</h3>
      <p className="module-link__summary">{summary}</p>
      <svg className="module-link__arrow" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 12h13M13 6l6 6-6 6" />
      </svg>
    </Link>
  );
}

function ProductIcon({ icon }: { icon: ModuleLinkProps["icon"] }) {
  if (icon === "picks") {
    return (
      <svg className="module-link__icon" viewBox="0 0 48 48" aria-hidden="true">
        <path d="M24 9v6M24 33v6M9 24h6M33 24h6" />
        <path d="M14 14l4 4M34 14l-4 4M14 34l4-4M34 34l-4-4" />
        <circle cx="24" cy="24" r="9" />
        <path d="M20 24l3 3 6-7" />
      </svg>
    );
  }

  if (icon === "strategy") {
    return (
      <svg className="module-link__icon" viewBox="0 0 48 48" aria-hidden="true">
        <path d="M12 34c6-13 18-21 30-22" />
        <path d="M10 34h14v-9h14" />
        <path d="M12 14h10v10H12zM28 26h8v8h-8z" />
      </svg>
    );
  }

  if (icon === "forecast") {
    return (
      <svg className="module-link__icon" viewBox="0 0 48 48" aria-hidden="true">
        <path d="M9 32h30" />
        <path d="M13 28l8-9 7 6 9-12" />
        <path d="M13 37h5M22 37h5M31 37h5" />
        <path d="M37 13v10H27" />
      </svg>
    );
  }

  if (icon === "championship") {
    return (
      <svg className="module-link__icon" viewBox="0 0 48 48" aria-hidden="true">
        <path d="M24 11v14" />
        <path d="M18 12h12l-2 8h-8z" />
        <path d="M18 36h12M21 25h6v11h-6z" />
        <path d="M15 16c-4 2-6 6-5 11 1 4 4 7 8 8" />
        <path d="M33 16c4 2 6 6 5 11-1 4-4 7-8 8" />
      </svg>
    );
  }

  return (
    <svg className="module-link__icon" viewBox="0 0 48 48" aria-hidden="true">
      <path d="M10 34h28" />
      <path d="M14 30V18M24 30V12M34 30V22" />
      <path d="M9 14l8 8 7-10 7 7 8-9" />
      <path d="M8 38h32" />
    </svg>
  );
}
