const DATE = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const DATETIME = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

export function fmtDate(iso: string) {
  return DATE.format(new Date(iso));
}

export function fmtDateTime(iso: string) {
  return `${DATETIME.format(new Date(iso))} UTC`;
}

export function fmtInZone(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(new Date(iso));
}

export function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

/** 88111 -> "1:28.111" */
export function fmtLapMs(ms: number | null | undefined) {
  if (ms == null) return "—";
  const total = ms / 1000;
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, "0")}`;
}

/** 88.111 -> "1:28.111" */
export function fmtLapS(sec: number | null | undefined) {
  return sec == null ? "—" : fmtLapMs(sec * 1000);
}

/** signed delta, e.g. "+0.312" */
export function fmtDelta(value: number | null | undefined, digits = 3) {
  if (value == null) return "—";
  const v = value.toFixed(digits);
  return value > 0 ? `+${v}` : v;
}

export function fmtNum(value: number | null | undefined, digits = 2) {
  return value == null ? "—" : value.toFixed(digits);
}

export function fmtOrdinal(value: number | null | undefined) {
  if (value == null) return "—";
  const s = ["th", "st", "nd", "rd"];
  const v = value % 100;
  return `${value}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

export function titleCase(value: string | null | undefined) {
  if (!value) return "—";
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
