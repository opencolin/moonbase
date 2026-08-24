"use server";

import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { events } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

/**
 * Mint or rotate the event's feed token.
 *
 * The token is the only thing guarding a read-only attendee feed, so
 * rotating has to be a first-class action — a URL pasted into a shared
 * Google Sheet is effectively public the moment that sheet is shared.
 */
export async function rotateFeedToken(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  if (!slug) return;

  const user = await getCurrentUser();
  if (!user) return;

  const event = await db
    .select({ id: events.id, hostId: events.hostId })
    .from(events)
    .where(eq(events.slug, slug))
    .get();
  if (!event || event.hostId !== user.id) return;

  await db
    .update(events)
    .set({ feedToken: nanoid(32) })
    .where(eq(events.id, event.id));

  revalidatePath(`/${slug}/manage/sheet`);
}

export async function disableFeed(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  if (!slug) return;

  const user = await getCurrentUser();
  if (!user) return;

  const event = await db
    .select({ id: events.id, hostId: events.hostId })
    .from(events)
    .where(eq(events.slug, slug))
    .get();
  if (!event || event.hostId !== user.id) return;

  await db
    .update(events)
    .set({ feedToken: null })
    .where(eq(events.id, event.id));

  revalidatePath(`/${slug}/manage/sheet`);
}
