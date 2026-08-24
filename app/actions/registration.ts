"use server";

import { and, count, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { events, registrations } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { formatEventDay, formatEventTime } from "@/lib/dates";
import { absoluteUrl, sendMail } from "@/lib/email";

const schema = z.object({
  eventId: z.string().min(1),
  ticketId: z.string().optional(),
  name: z.string().min(1, "Please enter your name").max(120),
  email: z.string().email("Enter a valid email"),
  guestCount: z.coerce.number().int().min(0).max(10).default(0),
});

export type RegisterState = {
  ok: boolean;
  status?: "going" | "pending" | "waitlist";
  error?: string;
};

export async function registerForEvent(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const parsed = schema.safeParse({
    eventId: formData.get("eventId"),
    ticketId: formData.get("ticketId") || undefined,
    name: formData.get("name"),
    email: formData.get("email"),
    guestCount: formData.get("guestCount") ?? 0,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;
  const email = data.email.trim().toLowerCase();

  const event = await db
    .select()
    .from(events)
    .where(eq(events.id, data.eventId))
    .get();
  if (!event) return { ok: false, error: "Event not found" };

  const user = await getCurrentUser();

  // Already registered? Treat as idempotent success.
  const existing = await db
    .select()
    .from(registrations)
    .where(
      and(
        eq(registrations.eventId, event.id),
        eq(registrations.email, email),
      ),
    )
    .get();
  if (existing) {
    await rememberGuest(email);
    return { ok: true, status: existing.status as RegisterState["status"] };
  }

  // Decide status: approval > capacity > going.
  let status: "going" | "pending" | "waitlist" = "going";
  if (event.requiresApproval) {
    status = "pending";
  } else if (event.capacity != null) {
    const going = await db
      .select({ c: count() })
      .from(registrations)
      .where(
        and(
          eq(registrations.eventId, event.id),
          eq(registrations.status, "going"),
        ),
      )
      .get();
    if ((going?.c ?? 0) + 1 + data.guestCount > event.capacity) {
      status = "waitlist";
    }
  }

  await db.insert(registrations).values({
    eventId: event.id,
    ticketId: data.ticketId ?? null,
    userId: user?.id ?? null,
    name: data.name.trim(),
    email,
    guestCount: data.guestCount,
    status,
  });

  // Fire-and-forget: sendMail never throws, and a bounced confirmation must
  // not fail a registration that already succeeded.
  await sendMail(
    status === "going"
      ? "registration.confirmed"
      : status === "pending"
        ? "registration.pending"
        : "registration.waitlisted",
    email,
    {
      name: data.name.trim(),
      eventTitle: event.title,
      eventUrl: absoluteUrl(`/${event.slug}`),
      when: `${formatEventDay(event.startAt, event.timezone)}, ${formatEventTime(event.startAt, event.endAt, event.timezone)}`,
      where: event.locationName ?? undefined,
    },
  );

  await rememberGuest(email);
  revalidatePath(`/${event.slug}`);
  return { ok: true, status };
}

/** Track guest email in a cookie so the event page shows the "you're in" state. */
async function rememberGuest(email: string) {
  const jar = await cookies();
  jar.set("luma_guest_email", email, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
