"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import {
  events,
  participants,
  teamJoinRequests,
  teamMembers,
  teams,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { ensureParticipant, uniqueTeamSlug } from "@/lib/teams";

/**
 * Team membership actions.
 *
 * Every mutation re-checks the event's max team size at write time rather
 * than trusting a "full" flag — two people accepting the last slot
 * simultaneously is the exact race a stored flag loses.
 */

type Result = { error?: string; ok?: boolean };

async function requireEvent(slug: string) {
  const event = await db
    .select()
    .from(events)
    .where(eq(events.slug, slug))
    .get();
  if (!event || !event.hackathonMode) return null;
  return event;
}

async function memberCount(teamId: string) {
  const row = await db
    .select({ c: count() })
    .from(teamMembers)
    .where(eq(teamMembers.teamId, teamId))
    .get();
  return row?.c ?? 0;
}

/* --------------------------- Create team -------------------------- */

const createSchema = z.object({
  eventSlug: z.string().min(1),
  name: z.string().trim().min(1, "Give your team a name").max(80),
  pitch: z.string().trim().max(280).optional(),
  trackId: z.string().optional(),
});

export async function createTeam(
  _prev: Result,
  formData: FormData,
): Promise<Result> {
  const parsed = createSchema.safeParse({
    eventSlug: formData.get("eventSlug"),
    name: formData.get("name"),
    pitch: formData.get("pitch") || undefined,
    trackId: formData.get("trackId") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  }
  const d = parsed.data;

  const user = await getCurrentUser();
  if (!user) redirect(`/signin?next=${encodeURIComponent(`/${d.eventSlug}/teams`)}`);

  const event = await requireEvent(d.eventSlug);
  if (!event) return { error: "Event not found" };

  // One team per person per event.
  const existing = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(and(eq(teams.eventId, event.id), eq(teamMembers.userId, user.id)))
    .get();
  if (existing) return { error: "You're already on a team for this event" };

  await ensureParticipant(event.id, user.id);

  const [team] = await db
    .insert(teams)
    .values({
      eventId: event.id,
      trackId: d.trackId || null,
      slug: await uniqueTeamSlug(event.id, d.name),
      name: d.name,
      pitch: d.pitch || null,
    })
    .returning();

  await db.insert(teamMembers).values({
    teamId: team.id,
    userId: user.id,
    role: "captain",
  });

  // Creating a team means you're no longer looking for one.
  await db
    .update(participants)
    .set({ lookingForTeam: false })
    .where(
      and(eq(participants.eventId, event.id), eq(participants.userId, user.id)),
    );

  revalidatePath(`/${event.slug}/teams`);
  redirect(`/${event.slug}/teams/${team.slug}`);
}

/* ---------------------------- Join flow --------------------------- */

export async function requestToJoin(formData: FormData): Promise<void> {
  const eventSlug = String(formData.get("eventSlug") ?? "");
  const teamSlug = String(formData.get("teamSlug") ?? "");
  const message = String(formData.get("message") ?? "").slice(0, 500);

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/signin?next=${encodeURIComponent(`/${eventSlug}/teams/${teamSlug}`)}`);
  }

  const event = await requireEvent(eventSlug);
  if (!event) return;

  const team = await db
    .select()
    .from(teams)
    .where(and(eq(teams.eventId, event.id), eq(teams.slug, teamSlug)))
    .get();
  if (!team) return;

  await ensureParticipant(event.id, user.id);

  const already = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(and(eq(teams.eventId, event.id), eq(teamMembers.userId, user.id)))
    .get();
  if (already) return;

  if (event.maxTeamSize != null && (await memberCount(team.id)) >= event.maxTeamSize) {
    return; // full — the page will render it as such
  }

  const existing = await db
    .select()
    .from(teamJoinRequests)
    .where(
      and(
        eq(teamJoinRequests.teamId, team.id),
        eq(teamJoinRequests.userId, user.id),
      ),
    )
    .get();

  if (existing) {
    await db
      .update(teamJoinRequests)
      .set({ status: "pending", message: message || null })
      .where(eq(teamJoinRequests.id, existing.id));
  } else {
    await db.insert(teamJoinRequests).values({
      teamId: team.id,
      userId: user.id,
      message: message || null,
    });
  }

  revalidatePath(`/${eventSlug}/teams/${teamSlug}`);
}

/** Captain-only: accept or decline a pending request. */
export async function resolveJoinRequest(formData: FormData): Promise<void> {
  const requestId = String(formData.get("requestId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!["accepted", "declined"].includes(decision)) return;

  const user = await getCurrentUser();
  if (!user) return;

  const row = await db
    .select({
      request: teamJoinRequests,
      team: teams,
      event: events,
    })
    .from(teamJoinRequests)
    .innerJoin(teams, eq(teams.id, teamJoinRequests.teamId))
    .innerJoin(events, eq(events.id, teams.eventId))
    .where(eq(teamJoinRequests.id, requestId))
    .get();
  if (!row) return;

  // Only the captain (or the event host) can resolve.
  const captain = await db
    .select()
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.teamId, row.team.id),
        eq(teamMembers.userId, user.id),
        eq(teamMembers.role, "captain"),
      ),
    )
    .get();
  if (!captain && row.event.hostId !== user.id) return;

  if (decision === "accepted") {
    const { maxTeamSize } = row.event;
    if (maxTeamSize != null && (await memberCount(row.team.id)) >= maxTeamSize) {
      return; // filled up while the request was pending
    }
    await db
      .insert(teamMembers)
      .values({ teamId: row.team.id, userId: row.request.userId });
    await db
      .update(participants)
      .set({ lookingForTeam: false })
      .where(
        and(
          eq(participants.eventId, row.event.id),
          eq(participants.userId, row.request.userId),
        ),
      );
  }

  await db
    .update(teamJoinRequests)
    .set({ status: decision })
    .where(eq(teamJoinRequests.id, requestId));

  revalidatePath(`/${row.event.slug}/teams/${row.team.slug}`);
  revalidatePath(`/${row.event.slug}/teams`);
}

/* ----------------------------- Leaving ---------------------------- */

export async function leaveTeam(formData: FormData): Promise<void> {
  const eventSlug = String(formData.get("eventSlug") ?? "");
  const teamSlug = String(formData.get("teamSlug") ?? "");

  const user = await getCurrentUser();
  if (!user) return;

  const event = await requireEvent(eventSlug);
  if (!event) return;

  const team = await db
    .select()
    .from(teams)
    .where(and(eq(teams.eventId, event.id), eq(teams.slug, teamSlug)))
    .get();
  if (!team) return;

  await db
    .delete(teamMembers)
    .where(
      and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, user.id)),
    );

  const remaining = await listMembers(team.id);
  if (remaining.length === 0) {
    // Last one out deletes the team. FK cascades are off, so children go first.
    await db.delete(teamJoinRequests).where(eq(teamJoinRequests.teamId, team.id));
    await db.delete(teams).where(eq(teams.id, team.id));
    redirect(`/${eventSlug}/teams`);
  }

  // Never leave a team captainless.
  if (!remaining.some((m) => m.role === "captain")) {
    await db
      .update(teamMembers)
      .set({ role: "captain" })
      .where(
        and(
          eq(teamMembers.teamId, team.id),
          eq(teamMembers.userId, remaining[0].userId),
        ),
      );
  }

  revalidatePath(`/${eventSlug}/teams/${teamSlug}`);
  redirect(`/${eventSlug}/teams`);
}

async function listMembers(teamId: string) {
  return db
    .select({ userId: teamMembers.userId, role: teamMembers.role })
    .from(teamMembers)
    .where(eq(teamMembers.teamId, teamId));
}

/* ------------------------- Team settings -------------------------- */

export async function setTeamOpen(formData: FormData): Promise<void> {
  const eventSlug = String(formData.get("eventSlug") ?? "");
  const teamSlug = String(formData.get("teamSlug") ?? "");
  const open = formData.get("open") === "true";

  const user = await getCurrentUser();
  if (!user) return;

  const event = await requireEvent(eventSlug);
  if (!event) return;

  const team = await db
    .select()
    .from(teams)
    .where(and(eq(teams.eventId, event.id), eq(teams.slug, teamSlug)))
    .get();
  if (!team) return;

  const captain = await db
    .select()
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.teamId, team.id),
        eq(teamMembers.userId, user.id),
        eq(teamMembers.role, "captain"),
      ),
    )
    .get();
  if (!captain && event.hostId !== user.id) return;

  await db.update(teams).set({ open }).where(eq(teams.id, team.id));
  revalidatePath(`/${eventSlug}/teams/${teamSlug}`);
  revalidatePath(`/${eventSlug}/teams`);
}

/** Builder directory opt-in. */
export async function setLookingForTeam(formData: FormData): Promise<void> {
  const eventSlug = String(formData.get("eventSlug") ?? "");
  const looking = formData.get("looking") === "true";

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/signin?next=${encodeURIComponent(`/${eventSlug}/builders`)}`);
  }

  const event = await requireEvent(eventSlug);
  if (!event) return;

  await ensureParticipant(event.id, user.id);
  await db
    .update(participants)
    .set({ lookingForTeam: looking })
    .where(
      and(eq(participants.eventId, event.id), eq(participants.userId, user.id)),
    );

  revalidatePath(`/${eventSlug}/builders`);
}
