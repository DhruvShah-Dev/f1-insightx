import { team } from "@/data/teams";
import { driverNumber } from "@/data/driver-numbers";

/** Relative luminance of a #rrggbb colour, used to pick legible ink. */
function ink(hex: string) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.55 ? "#05070a" : "#ffffff";
}

/**
 * Side-profile racing helmet painted in the team colour, carrying the driver's
 * car number (or three-letter code when the number is unknown).
 */
export function Helmet({
  color,
  label,
  compact = false,
}: {
  color: string;
  label: string;
  compact?: boolean;
}) {
  const fg = ink(color);
  return (
    <svg viewBox="0 0 48 48" className="h-full w-full" aria-hidden>
      {/* shell */}
      <path
        d="M24 6.5c9.8 0 16.6 6.7 16.6 16 0 3.2-.7 5.9-2 8l-13.5.6-1.7 6.2c-6.6.6-11.8-.8-15.1-3.8C5.1 30.5 3.6 27 3.6 22.9 3.6 13.3 12.3 6.5 24 6.5Z"
        fill={color}
      />
      {/* top highlight */}
      <path
        d="M24 6.5c6 0 11 2.5 13.8 6.6-3.8-2.3-8.4-3.5-13.8-3.5-5.6 0-10.4 1.3-14.3 3.8C12.6 9.1 17.8 6.5 24 6.5Z"
        fill={fg}
        opacity="0.22"
      />
      {/* visor */}
      <path
        d="M13.4 19.2c3.8-3.6 8.8-5.3 14.8-5.1l6.9.3c1.5 1.8 2.4 3.9 2.6 6.3l-22.5.4c-1.1 0-2-.5-1.8-1.9Z"
        fill="#05070a"
        opacity="0.9"
      />
      <path
        d="M15.6 18.6c3.3-2.6 7.4-3.8 12.3-3.7l4.4.2"
        stroke={fg}
        strokeWidth="1"
        opacity="0.35"
        fill="none"
      />
      {/* chin bar */}
      <path d="M8.3 32.4 38.6 31l-.7 2.4-28.6 1.5Z" fill="#05070a" opacity="0.45" />
      {/* number plate */}
      <rect
        x={label.length > 2 ? 14.5 : 17.5}
        y={compact ? 21.4 : 21.8}
        width={label.length > 2 ? 21 : 15}
        height="9.2"
        rx="2.2"
        fill={fg}
        opacity="0.92"
      />
      <text
        x="25"
        y="29"
        textAnchor="middle"
        fontSize={label.length > 2 ? 7.4 : 9.2}
        fontWeight="900"
        fontStyle="italic"
        fill={color}
        fontFamily="ui-monospace, SFMono-Regular, monospace"
      >
        {label}
      </text>

    </svg>
  );
}

/**
 * Driver identity chip: team-coloured helmet carrying the car number, inside a
 * team-tinted ring, with the three-letter code beneath.
 */
export function DriverAvatar({
  code,
  teamName,
  name,
  size = "md",
  showCode = true,
}: {
  code: string;
  teamName?: string | null | undefined;
  name?: string | undefined;
  size?: "sm" | "md" | "lg" | undefined;
  showCode?: boolean | undefined;
}) {
  const t = team(teamName);
  const box = size === "lg" ? "h-14 w-14" : size === "md" ? "h-10 w-10" : "h-7 w-7";
  const no = driverNumber(code);
  const label = no != null ? String(no) : code;

  return (
    <span
      className={`${box} relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full`}
      style={{
        backgroundColor: `color-mix(in oklab, ${t.color} 18%, #05070a)`,
        boxShadow: `inset 0 0 0 1.5px color-mix(in oklab, ${t.color} 70%, transparent)`,
      }}
      title={`${name ?? code}${no != null ? ` · #${no}` : ""} · ${t.name}`}
    >
      <span className={size === "sm" ? "p-0.5" : "p-1"}>
        <Helmet color={t.color} label={label} compact={size === "sm"} />
      </span>
      {showCode && size !== "sm" ? (
        <span
          aria-hidden
          className="num absolute inset-x-0 bottom-0 bg-background/75 text-center text-[8px] font-black uppercase tracking-widest"
          style={{ color: t.color }}
        >
          {code}
        </span>
      ) : null}
    </span>
  );
}

/** Team mark for string-typed team names coming out of the database. */
export function TeamBadge({
  teamName,
  showName = false,
  size = "sm",
}: {
  teamName?: string | null | undefined;
  showName?: boolean | undefined;
  size?: "sm" | "md" | undefined;
}) {
  const t = team(teamName);
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
        <span className="truncate text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          {t.name}
        </span>
      ) : null}
    </span>
  );
}
