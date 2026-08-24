/**
 * Timezone conversion check (v0.5).
 *
 *   pnpm tz:check          # runs in whatever TZ the shell has
 *   TZ=UTC pnpm tz:check   # the case that breaks naive `new Date(...)`
 *
 * The point of the exercise: results must be identical under every server
 * TZ. If they are not, stored instants depend on where the server happens
 * to run, which is the bug this pass exists to kill.
 */
import {
  isValidTimeZone,
  utcToZonedInput,
  zonedTimeToUtc,
} from "../lib/dates";

type Case = { local: string; tz: string; expectIso: string; note: string };

const cases: Case[] = [
  {
    local: "2026-08-17T09:00",
    tz: "America/Los_Angeles",
    expectIso: "2026-08-17T16:00:00.000Z",
    note: "PDT (UTC-7)",
  },
  {
    local: "2026-01-17T09:00",
    tz: "America/Los_Angeles",
    expectIso: "2026-01-17T17:00:00.000Z",
    note: "PST (UTC-8) — DST boundary",
  },
  {
    local: "2026-08-17T09:00",
    tz: "Asia/Tokyo",
    expectIso: "2026-08-17T00:00:00.000Z",
    note: "JST (UTC+9), no DST",
  },
  {
    local: "2026-08-17T09:00",
    tz: "UTC",
    expectIso: "2026-08-17T09:00:00.000Z",
    note: "UTC identity",
  },
  {
    local: "2026-08-17T00:30",
    tz: "Pacific/Kiritimati",
    expectIso: "2026-08-16T10:30:00.000Z",
    note: "UTC+14, crosses the date line",
  },
];

let failures = 0;

console.log(`→ Server TZ: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
console.log(`→ Naive parse of "2026-08-17T09:00" → ${new Date("2026-08-17T09:00").toISOString()}  (server-local: the bug)\n`);

for (const c of cases) {
  const got = zonedTimeToUtc(c.local, c.tz);
  const ok = got.toISOString() === c.expectIso;
  if (!ok) failures++;
  console.log(
    `${ok ? "✓" : "✗"} ${c.local} @ ${c.tz.padEnd(22)} → ${got.toISOString()}  ${c.note}`,
  );
  if (!ok) console.log(`    expected ${c.expectIso}`);

  // Round-trip must return the wall clock we started with.
  const back = utcToZonedInput(got, c.tz);
  if (back !== c.local) {
    failures++;
    console.log(`    ✗ round-trip returned ${back}, expected ${c.local}`);
  }
}

if (!isValidTimeZone("Not/AZone")) console.log("✓ rejects unknown timezone");
else {
  failures++;
  console.log("✗ accepted an unknown timezone");
}

console.log(
  failures ? `\n✗ ${failures} failure(s)` : "\n✓ all timezone checks passed",
);
process.exit(failures ? 1 : 0);
