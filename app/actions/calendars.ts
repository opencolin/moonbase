"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { calendarSubscriptions, calendars } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

/**
 * Subscribe/unsubscribe toggle. Signed-out visitors are bounced to sign-in
 * and returned to the calendar, so the button never silently no-ops.
 */
export async function toggleSubscribe(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  if (!slug) return;

  const user = await getCurrentUser();
  if (!user) redirect(`/signin?next=${encodeURIComponent(`/c/${slug}`)}`);

  const calendar = await db
    .select({ id: calendars.id })
    .from(calendars)
    .where(eq(calendars.slug, slug))
    .get();
  if (!calendar) return;

  const where = and(
    eq(calendarSubscriptions.calendarId, calendar.id),
    eq(calendarSubscriptions.userId, user.id),
  );

  const existing = await db
    .select()
    .from(calendarSubscriptions)
    .where(where)
    .get();

  if (existing) {
    await db.delete(calendarSubscriptions).where(where);
  } else {
    await db
      .insert(calendarSubscriptions)
      .values({ calendarId: calendar.id, userId: user.id });
  }

  revalidatePath(`/c/${slug}`);
}
