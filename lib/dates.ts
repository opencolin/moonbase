// Timezone-aware formatting via Intl (no extra deps).

function parts(date: Date, tz: string, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, ...opts }).format(date);
}

/** "Wednesday, June 10" (year added when not the current year). */
export function formatEventDay(start: Date, tz = "America/Los_Angeles") {
  const thisYear = new Date().getFullYear();
  const startYear = Number(parts(start, tz, { year: "numeric" }));
  return parts(start, tz, {
    weekday: "long",
    month: "long",
    day: "numeric",
    ...(startYear !== thisYear ? { year: "numeric" } : {}),
  });
}

/** "10:00 AM – 8:00 PM" or "10:00 AM" when no end. */
export function formatEventTime(
  start: Date,
  end: Date | null,
  tz = "America/Los_Angeles",
) {
  const t = (d: Date) =>
    parts(d, tz, { hour: "numeric", minute: "2-digit", hour12: true });
  const tzAbbr =
    new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" })
      .formatToParts(start)
      .find((p) => p.type === "timeZoneName")?.value ?? "";
  return end ? `${t(start)} – ${t(end)} ${tzAbbr}` : `${t(start)} ${tzAbbr}`;
}

/** Compact date tile: { month: "JUN", day: "10" } */
export function dateTile(start: Date, tz = "America/Los_Angeles") {
  return {
    month: parts(start, tz, { month: "short" }).toUpperCase(),
    day: parts(start, tz, { day: "numeric" }),
  };
}

/** Discover-style grouping label: "Today", "Tomorrow", or weekday + date. */
export function relativeDayLabel(start: Date, tz = "America/Los_Angeles") {
  const fmt = (d: Date) => parts(d, tz, { year: "numeric", month: "2-digit", day: "2-digit" });
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86_400_000);
  if (fmt(start) === fmt(now)) return "Today";
  if (fmt(start) === fmt(tomorrow)) return "Tomorrow";
  return parts(start, tz, { weekday: "long", month: "long", day: "numeric" });
}

export function isPast(end: Date | null, start: Date) {
  return (end ?? start).getTime() < Date.now();
}

/* ------------------- Wall-clock ⇄ instant conversion ------------------- */

/** How far `timeZone` is ahead of UTC at the given instant, in ms. */
function tzOffsetMs(instant: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;

  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - instant.getTime();
}

/**
 * Turn a `datetime-local` value ("2026-08-17T09:00") plus an IANA zone into
 * the correct instant.
 *
 * `new Date("2026-08-17T09:00")` parses as **server-local** time, which is
 * silently wrong the moment the server and the host are in different zones —
 * the classic "works on my machine, off by 8 hours in production" bug. Every
 * wall-clock string entering the DB must come through here.
 *
 * Two passes because the offset depends on the instant we're still solving
 * for; the second pass settles DST boundaries.
 */
export function zonedTimeToUtc(local: string, timeZone: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(local.trim());
  if (!match) return new Date(NaN);

  const [, y, mo, d, h, mi] = match.map(Number) as unknown as number[];
  const wall = Date.UTC(y, mo - 1, d, h, mi);

  let instant = wall;
  for (let i = 0; i < 2; i++) {
    instant = wall - tzOffsetMs(new Date(instant), timeZone);
  }
  return new Date(instant);
}

/** Inverse of {@link zonedTimeToUtc} — for prefilling `datetime-local` inputs. */
export function utcToZonedInput(instant: Date, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;

  const hour = String(Number(parts.hour) % 24).padStart(2, "0");
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`;
}

/** Reject zones Intl doesn't know, so a bad value can't poison stored instants. */
export function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}
