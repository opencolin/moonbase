import "server-only";
import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  events,
  participants,
  teamJoinRequests,
  teamMembers,
  teams,
  tracks,
  users,
  type Event,
} from "@/db/schema";

/**
 * Teams, the builder directory, and the rules around joining.
 *
 * "Full" is always *computed* from the event's max team size rather than
 * stored, so a team's roster and its openness can never drift apart — the
 * failure mode Sprint hit when "full" was a label someone had to remember
 * to set.
 */

export type TeamFilter = "all" | "looking" | "closed" | "full";
export type BuilderFilter = "all" | "looking" | "in_team";

export function slugifyTeam(name: string) {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "team"
  );
}

export async function uniqueTeamSlug(eventId: string, name: string) {
  const root = slugifyTeam(name);
  for (const candidate of [root, ...[2, 3, 4, 5, 6].map((n) => `${root}-${n}`)]) {
    const taken = await db
      .select({ id: teams.id })
      .from(teams)
      .where(and(eq(teams.eventId, eventId), eq(teams.slug, candidate)))
      .get();
    if (!taken) return candidate;
  }
  return `${root}-${Math.random().toString(36).slice(2, 7)}`;
}

/* ----------------------------- Reads ------------------------------ */

export type TeamRow = {
  team: typeof teams.$inferSelect;
  track: typeof tracks.$inferSelect | null;
  memberCount: number;
  full: boolean;
};

/** All teams in an event, with member counts and computed fullness. */
export async function listTeams(
  event: Pick<Event, "id" | "maxTeamSize">,
  opts?: { filter?: TeamFilter; trackId?: string; q?: string },
): Promise<TeamRow[]> {
  const { filter = "all", trackId, q } = opts ?? {};

  const conds = [eq(teams.eventId, event.id)];
  if (trackId) conds.push(eq(teams.trackId, trackId));

  const rows = await db
    .select({
      team: teams,
      track: tracks,
      memberCount: count(teamMembers.userId),
    })
    .from(teams)
    .leftJoin(tracks, eq(tracks.id, teams.trackId))
    .leftJoin(teamMembers, eq(teamMembers.teamId, teams.id))
    .where(and(...conds))
    .groupBy(teams.id)
    .orderBy(asc(teams.name));

  const max = event.maxTeamSize;
  let mapped: TeamRow[] = rows.map((r) => ({
    team: r.team,
    track: r.track,
    memberCount: r.memberCount,
    full: max != null && r.memberCount >= max,
  }));

  if (q) {
    const needle = q.toLowerCase();
    mapped = mapped.filter(
      (r) =>
        r.team.name.toLowerCase().includes(needle) ||
        (r.team.pitch ?? "").toLowerCase().includes(needle),
    );
  }

  switch (filter) {
    case "looking":
      return mapped.filter((r) => r.team.open && !r.full);
    case "closed":
      return mapped.filter((r) => !r.team.open);
    case "full":
      return mapped.filter((r) => r.full);
    default:
      return mapped;
  }
}

export async function getTeamBySlug(eventId: string, slug: string) {
  const row = await db
    .select({ team: teams, track: tracks })
    .from(teams)
    .leftJoin(tracks, eq(tracks.id, teams.trackId))
    .where(and(eq(teams.eventId, eventId), eq(teams.slug, slug)))
    .get();
  if (!row) return null;

  const members = await listTeamMembers(row.team.id);
  return { ...row, members };
}

export async function listTeamMembers(teamId: string) {
  return db
    .select({ user: users, role: teamMembers.role })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .where(eq(teamMembers.teamId, teamId))
    .orderBy(asc(teamMembers.createdAt));
}

/** The team a user belongs to in an event, if any. */
export async function getUserTeam(eventId: string, userId: string) {
  return (
    (await db
      .select({ team: teams, role: teamMembers.role })
      .from(teamMembers)
      .innerJoin(teams, eq(teams.id, teamMembers.teamId))
      .where(and(eq(teams.eventId, eventId), eq(teamMembers.userId, userId)))
      .get()) ?? null
  );
}

/** A specific user's outstanding request for a team, if any. */
export async function getPendingRequest(teamId: string, userId: string) {
  return (
    (await db
      .select()
      .from(teamJoinRequests)
      .where(
        and(
          eq(teamJoinRequests.teamId, teamId),
          eq(teamJoinRequests.userId, userId),
          eq(teamJoinRequests.status, "pending"),
        ),
      )
      .get()) ?? null
  );
}

export async function listJoinRequests(teamId: string) {
  return db
    .select({ request: teamJoinRequests, user: users })
    .from(teamJoinRequests)
    .innerJoin(users, eq(users.id, teamJoinRequests.userId))
    .where(
      and(
        eq(teamJoinRequests.teamId, teamId),
        eq(teamJoinRequests.status, "pending"),
      ),
    );
}

export type BuilderRow = {
  user: typeof users.$inferSelect;
  participant: typeof participants.$inferSelect;
  team: typeof teams.$inferSelect | null;
};

/** Builder directory: everyone participating, and whether they have a team. */
export async function listBuilders(
  eventId: string,
  opts?: { filter?: BuilderFilter; q?: string },
): Promise<BuilderRow[]> {
  const { filter = "all", q } = opts ?? {};

  const rows = await db
    .select({ user: users, participant: participants })
    .from(participants)
    .innerJoin(users, eq(users.id, participants.userId))
    .where(eq(participants.eventId, eventId))
    .orderBy(asc(users.name));

  // One extra query rather than N: map every membership in this event.
  const memberships = await db
    .select({ userId: teamMembers.userId, team: teams })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(eq(teams.eventId, eventId));
  const teamByUser = new Map(memberships.map((m) => [m.userId, m.team]));

  let mapped: BuilderRow[] = rows.map((r) => ({
    ...r,
    team: teamByUser.get(r.user.id) ?? null,
  }));

  if (q) {
    const needle = q.toLowerCase();
    mapped = mapped.filter(
      (r) =>
        r.user.name.toLowerCase().includes(needle) ||
        r.user.email.toLowerCase().includes(needle),
    );
  }

  switch (filter) {
    case "looking":
      return mapped.filter((r) => !r.team && r.participant.lookingForTeam);
    case "in_team":
      return mapped.filter((r) => r.team);
    default:
      return mapped;
  }
}

/** Headline counts for the event's team/builder pages. */
export async function teamStats(event: Pick<Event, "id" | "maxTeamSize">) {
  const all = await listTeams(event);
  const builders = await listBuilders(event.id);
  return {
    teams: all.length,
    open: all.filter((t) => t.team.open && !t.full).length,
    builders: builders.length,
    unattached: builders.filter((b) => !b.team).length,
    avgSize: all.length
      ? Math.round(
          (all.reduce((sum, t) => sum + t.memberCount, 0) / all.length) * 10,
        ) / 10
      : 0,
  };
}

/* ---------------------------- Helpers ----------------------------- */

/** Ensure a participant row exists — idempotent, safe on every visit. */
export async function ensureParticipant(eventId: string, userId: string) {
  const existing = await db
    .select()
    .from(participants)
    .where(
      and(eq(participants.eventId, eventId), eq(participants.userId, userId)),
    )
    .get();
  if (existing) return existing;

  const [created] = await db
    .insert(participants)
    .values({ eventId, userId })
    .returning();
  return created;
}

export async function isEventHost(eventId: string, userId: string) {
  const row = await db
    .select({ hostId: events.hostId })
    .from(events)
    .where(eq(events.id, eventId))
    .get();
  return row?.hostId === userId;
}

export async function listTracks(eventId: string) {
  return db
    .select()
    .from(tracks)
    .where(eq(tracks.eventId, eventId))
    .orderBy(asc(tracks.sortOrder), asc(tracks.name));
}

/** Participant + team counts per track, for the organizer's track list. */
export async function trackCounts(eventId: string) {
  const teamRows = await db
    .select({ trackId: teams.trackId, c: count() })
    .from(teams)
    .where(eq(teams.eventId, eventId))
    .groupBy(teams.trackId);

  const memberRows = await db
    .select({ trackId: teams.trackId, c: count() })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(eq(teams.eventId, eventId))
    .groupBy(teams.trackId);

  return {
    teams: new Map(teamRows.map((r) => [r.trackId, r.c])),
    members: new Map(memberRows.map((r) => [r.trackId, r.c])),
  };
}

export { sql, inArray };
