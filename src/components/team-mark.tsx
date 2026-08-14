import { teams, type TeamKey } from "@/data/season";

/**
 * Team identity mark: color-blocked monogram badge, legible on dark surfaces.
 */
export function TeamMark({
  team,
  size = "sm",
  showName = false,
}: {
  team: TeamKey;
  size?: "sm" | "md";
  showName?: boolean;
}) {
  const t = teams[team];
  const box = size === "md" ? "h-7 px-2 text-[11px]" : "h-5 px-1.5 text-[10px]";

  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`num inline-flex items-center rounded-sm font-black uppercase tracking-widest ${box}`}
        style={{
          color: t.color,
          backgroundColor: `color-mix(in oklab, ${t.color} 16%, transparent)`,
          boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${t.color} 45%, transparent)`,
        }}
      >
        {t.short}
      </span>
      {showName ? (
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          {t.name}
        </span>
      ) : null}
    </span>
  );
}
