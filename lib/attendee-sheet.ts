import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  registrations,
  teamMembers,
  teams,
  tickets,
  tracks,
  type Event,
} from "@/db/schema";

/**
 * The attendee sheet's single source of columns.
 *
 * The on-screen grid, the CSV download, and the Google Sheets feed all read
 * from here. Three call sites building their own column lists is how a
 * printed check-in sheet ends up disagreeing with the spreadsheet the door
 * staff are looking at.
 */

export type SheetColumn = {
  key: string;
  label: string;
  /** Rendering hint for the grid; numbers right-align, as in Sheets. */
  type?: "text" | "number" | "date";
  width?: number;
};

export type SheetData = {
  columns: SheetColumn[];
  rows: Record<string, string>[];
};

const BASE_COLUMNS: SheetColumn[] = [
  { key: "name", label: "Name", width: 200 },
  { key: "email", label: "Email", width: 240 },
  { key: "status", label: "Status", width: 110 },
  { key: "ticket", label: "Ticket", width: 150 },
  { key: "guests", label: "Guests", type: "number", width: 80 },
  { key: "registered", label: "Registered", type: "date", width: 180 },
];

const HACKATHON_COLUMNS: SheetColumn[] = [
  { key: "team", label: "Team", width: 180 },
  { key: "track", label: "Track", width: 180 },
  { key: "role", label: "Team role", width: 110 },
];

/**
 * Every registration for an event, flattened into sheet rows.
 *
 * Hackathon events get team columns; a plain meetup never sees them, which
 * keeps the printed sheet as short as the event actually is.
 */
export async function buildAttendeeSheet(
  event: Pick<Event, "id" | "hackathonMode" | "timezone">,
): Promise<SheetData> {
  const [regs, ticketRows] = await Promise.all([
    db
      .select()
      .from(registrations)
      .where(eq(registrations.eventId, event.id))
      .orderBy(asc(registrations.name)),
    db.select().from(tickets).where(eq(tickets.eventId, event.id)),
  ]);

  const ticketName = new Map(ticketRows.map((t) => [t.id, t.name]));

  // Team membership is keyed by user, but registrations may be guest rows
  // with no user at all — hence the null-safe lookup below.
  let teamByUser = new Map<
    string,
    { team: string; track: string | null; role: string }
  >();

  if (event.hackathonMode) {
    const rows = await db
      .select({
        userId: teamMembers.userId,
        role: teamMembers.role,
        teamName: teams.name,
        trackName: tracks.name,
      })
      .from(teamMembers)
      .innerJoin(teams, eq(teams.id, teamMembers.teamId))
      .leftJoin(tracks, eq(tracks.id, teams.trackId))
      .where(eq(teams.eventId, event.id));

    teamByUser = new Map(
      rows.map((r) => [
        r.userId,
        { team: r.teamName, track: r.trackName, role: r.role },
      ]),
    );
  }

  const fmtDate = (d: Date) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: event.timezone,
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(d);

  const rows = regs.map((r) => {
    const membership = r.userId ? teamByUser.get(r.userId) : undefined;
    const row: Record<string, string> = {
      name: r.name,
      email: r.email,
      status: r.status,
      ticket: r.ticketId ? (ticketName.get(r.ticketId) ?? "") : "",
      guests: String(r.guestCount),
      registered: fmtDate(r.createdAt),
    };
    if (event.hackathonMode) {
      row.team = membership?.team ?? "";
      row.track = membership?.track ?? "";
      row.role = membership?.role ?? "";
    }
    return row;
  });

  return {
    columns: event.hackathonMode
      ? [...BASE_COLUMNS, ...HACKATHON_COLUMNS]
      : BASE_COLUMNS,
    rows,
  };
}

/**
 * RFC 4180 CSV.
 *
 * The leading-character guard is the important bit: a name like `=cmd|...`
 * is a live formula the moment Excel or Sheets opens the file. Prefixing
 * with an apostrophe keeps it inert text.
 */
export function toCsv(data: SheetData): string {
  const escape = (value: string) => {
    const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
    return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
  };

  const header = data.columns.map((c) => escape(c.label)).join(",");
  const body = data.rows.map((row) =>
    data.columns.map((c) => escape(row[c.key] ?? "")).join(","),
  );
  return [header, ...body].join("\r\n");
}
