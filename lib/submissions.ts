import "server-only";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import {
  submissionFields,
  submissionMedia,
  submissionValues,
  submissions,
  teamMembers,
  teams,
  tracks,
  users,
  type Event,
} from "@/db/schema";
import { safeSlug } from "@/lib/media";

/**
 * Submissions.
 *
 * Two rules carried over from Sprint, both load-bearing:
 *
 * 1. **Roster inheritance.** A submission never stores its own member list —
 *    it belongs to a team and the roster is read through. Sprint had to
 *    reconcile two lists; a foreign key means they cannot drift at all.
 *
 * 2. **Explicit team matching.** Sprint matched a submission to a team by
 *    name or issue number, never by inferring from overlapping handles,
 *    because a wrong auto-join on a public showcase is worse than an
 *    unlinked one. Here the link is a real FK, which is the same guarantee
 *    with none of the matching.
 */

export type FieldWithValue = {
  field: typeof submissionFields.$inferSelect;
  value: string | null;
};

/** Fields for an event, plus any specific to the given track. */
export async function listFields(eventId: string, trackId?: string | null) {
  return db
    .select()
    .from(submissionFields)
    .where(
      and(
        eq(submissionFields.eventId, eventId),
        trackId
          ? or(
              isNull(submissionFields.trackId),
              eq(submissionFields.trackId, trackId),
            )
          : isNull(submissionFields.trackId),
      ),
    )
    .orderBy(asc(submissionFields.sortOrder));
}

export async function getSubmissionForTeam(teamId: string) {
  return (
    (await db
      .select()
      .from(submissions)
      .where(eq(submissions.teamId, teamId))
      .get()) ?? null
  );
}

export async function getSubmissionValues(
  submissionId: string,
): Promise<Map<string, string | null>> {
  const rows = await db
    .select()
    .from(submissionValues)
    .where(eq(submissionValues.submissionId, submissionId));
  return new Map(rows.map((r) => [r.fieldId, r.value]));
}

export async function getSubmissionMedia(submissionId: string) {
  return db
    .select()
    .from(submissionMedia)
    .where(eq(submissionMedia.submissionId, submissionId))
    .orderBy(asc(submissionMedia.sortOrder));
}

export type ShowcaseRow = {
  submission: typeof submissions.$inferSelect;
  team: typeof teams.$inferSelect;
  track: typeof tracks.$inferSelect | null;
};

/** Submitted projects only — drafts never appear in public views. */
export async function listShowcase(
  eventId: string,
  opts?: { q?: string; trackId?: string },
): Promise<ShowcaseRow[]> {
  const conds = [
    eq(submissions.eventId, eventId),
    eq(submissions.status, "submitted"),
  ];
  if (opts?.trackId) conds.push(eq(submissions.trackId, opts.trackId));

  const rows = await db
    .select({ submission: submissions, team: teams, track: tracks })
    .from(submissions)
    .innerJoin(teams, eq(teams.id, submissions.teamId))
    .leftJoin(tracks, eq(tracks.id, submissions.trackId))
    .where(and(...conds))
    .orderBy(asc(submissions.title));

  if (!opts?.q) return rows;
  const needle = opts.q.toLowerCase();
  return rows.filter(
    (r) =>
      r.submission.title.toLowerCase().includes(needle) ||
      (r.submission.tagline ?? "").toLowerCase().includes(needle) ||
      r.team.name.toLowerCase().includes(needle),
  );
}

/** A project page: submission, its team, the inherited roster, and media. */
export async function getSubmissionBySlug(eventId: string, slug: string) {
  const row = await db
    .select({ submission: submissions, team: teams, track: tracks })
    .from(submissions)
    .innerJoin(teams, eq(teams.id, submissions.teamId))
    .leftJoin(tracks, eq(tracks.id, submissions.trackId))
    .where(and(eq(submissions.eventId, eventId), eq(submissions.slug, slug)))
    .get();
  if (!row) return null;

  const [roster, media, fields, values] = await Promise.all([
    // Roster inheritance: read through to the team, never a stored copy.
    db
      .select({ user: users, role: teamMembers.role })
      .from(teamMembers)
      .innerJoin(users, eq(users.id, teamMembers.userId))
      .where(eq(teamMembers.teamId, row.team.id))
      .orderBy(asc(teamMembers.createdAt)),
    getSubmissionMedia(row.submission.id),
    listFields(eventId, row.submission.trackId),
    getSubmissionValues(row.submission.id),
  ]);

  return {
    ...row,
    roster,
    media,
    fields: fields.map((field) => ({
      field,
      value: values.get(field.id) ?? null,
    })) as FieldWithValue[],
  };
}

export async function uniqueSubmissionSlug(eventId: string, title: string) {
  const root = safeSlug(title);
  for (const candidate of [root, ...[2, 3, 4, 5, 6].map((n) => `${root}-${n}`)]) {
    const taken = await db
      .select({ id: submissions.id })
      .from(submissions)
      .where(
        and(eq(submissions.eventId, eventId), eq(submissions.slug, candidate)),
      )
      .get();
    if (!taken) return candidate;
  }
  return `${root}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Submissions close at the deadline; before that a team can keep editing. */
export function submissionsOpen(event: Pick<Event, "submissionDeadline">) {
  if (!event.submissionDeadline) return true;
  return event.submissionDeadline.getTime() > Date.now();
}
