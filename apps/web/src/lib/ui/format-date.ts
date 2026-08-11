// One date vocabulary for the whole product.
//
// Pages previously mixed `AUG 23, 2026 - 13:00 UTC`, `JUL 26, 2026`,
// `JUL 9, 2026, 4:08 PM UTC` and `31 Jul 2026`, sometimes on the same screen.
// Everything below renders in UTC so a server-rendered timestamp and a
// client-rendered one always agree.

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const TIME_FORMAT = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

function parse(value: string | number | Date | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `23 Aug 2026` */
export function formatDateLabel(value: string | number | Date | null | undefined, fallback = "Date pending") {
  const date = parse(value);
  return date ? DATE_FORMAT.format(date) : fallback;
}

/** `23 Aug 2026, 13:00 UTC` */
export function formatDateTimeLabel(value: string | number | Date | null | undefined, fallback = "Time pending") {
  const date = parse(value);
  return date ? `${DATE_FORMAT.format(date)}, ${TIME_FORMAT.format(date)} UTC` : fallback;
}
