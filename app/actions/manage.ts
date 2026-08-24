"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { events, registrations } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { formatEventDay, formatEventTime } from "@/lib/dates";
import { absoluteUrl, sendMail } from "@/lib/email";

const schema = z.object({
  registrationId: z.string().min(1),
  status: z.enum(["going", "pending", "waitlist", "declined"]),
});

/** Host-only: change a guest's status (approve/decline/waitlist). */
export async function setRegistrationStatus(formData: FormData): Promise<void> {
  const parsed = schema.safeParse({
    registrationId: formData.get("registrationId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return;

  const user = await getCurrentUser();
  if (!user) return;

  // Verify the registration belongs to an event this user hosts.
  const row = await db
    .select({
      event: events,
      guestName: registrations.name,
      guestEmail: registrations.email,
      previousStatus: registrations.status,
    })
    .from(registrations)
    .innerJoin(events, eq(events.id, registrations.eventId))
    .where(eq(registrations.id, parsed.data.registrationId))
    .get();

  if (!row || row.event.hostId !== user.id) return;

  await db
    .update(registrations)
    .set({ status: parsed.data.status })
    .where(eq(registrations.id, parsed.data.registrationId));

  await notifyStatusChange(row, parsed.data.status);

  revalidatePath(`/${row.event.slug}/manage`);
  revalidatePath(`/${row.event.slug}`);
}

type StatusRow = {
  event: typeof events.$inferSelect;
  guestName: string;
  guestEmail: string;
  previousStatus: string;
};

/**
 * Email the guest when a host decision actually changes something. Re-saving
 * the same status is a no-op, so hosts can't accidentally spam a guest by
 * clicking twice.
 */
async function notifyStatusChange(row: StatusRow, status: string) {
  if (status === row.previousStatus) return;

  const base = {
    name: row.guestName,
    eventTitle: row.event.title,
    eventUrl: absoluteUrl(`/${row.event.slug}`),
  };

  if (status === "going") {
    await sendMail("registration.approved", row.guestEmail, {
      ...base,
      when: `${formatEventDay(row.event.startAt, row.event.timezone)}, ${formatEventTime(row.event.startAt, row.event.endAt, row.event.timezone)}`,
      where: row.event.locationName ?? undefined,
    });
  } else if (status === "declined") {
    await sendMail("registration.declined", row.guestEmail, {
      name: row.guestName,
      eventTitle: row.event.title,
    });
  } else if (status === "waitlist") {
    await sendMail("registration.waitlisted", row.guestEmail, base);
  }
}
