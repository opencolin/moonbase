"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@/db";
import { eventHosts, events, tickets } from "@/db/schema";
import { createSession, findOrCreateUser, getCurrentUser } from "@/lib/auth";
import { isValidTimeZone, zonedTimeToUtc } from "@/lib/dates";
import { defaultOrganizationFor } from "@/lib/organizations";

const emptyToUndef = (v: unknown) =>
  v === "" || v === null || v === undefined ? undefined : v;

const schema = z.object({
  title: z.string().trim().min(1, "Give your event a name").max(140),
  description: z.string().max(8000).optional().default(""),
  startAt: z.string().min(1, "Pick a start time"),
  endAt: z.string().optional(),
  timezone: z.string().default("America/Los_Angeles"),
  locationType: z.enum(["physical", "online", "tbd"]).default("physical"),
  locationName: z.string().max(200).optional(),
  locationAddress: z.string().max(300).optional(),
  locationUrl: z.string().max(500).optional(),
  visibility: z.enum(["public", "unlisted"]).default("public"),
  category: z.string().optional(),
  themeColor: z.string().default("indigo"),
  coverPattern: z.string().default("aurora"),
  capacity: z.preprocess(emptyToUndef, z.coerce.number().int().positive().optional()),
  requiresApproval: z.coerce.boolean().default(false),
  priceType: z.enum(["free", "paid"]).default("free"),
  price: z.preprocess(emptyToUndef, z.coerce.number().min(0).optional()),
  // host identity (used when not signed in)
  hostName: z.string().optional(),
  hostEmail: z.string().optional(),
});

export type CreateState = { error?: string; fieldErrors?: Record<string, string> };

export async function createEvent(
  _prev: CreateState,
  formData: FormData,
): Promise<CreateState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = schema.safeParse({
    ...raw,
    requiresApproval: formData.get("requiresApproval") === "on" || raw.requiresApproval === "true",
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: first?.message ?? "Please check the form" };
  }
  const d = parsed.data;

  // Resolve host: signed-in user, else create one from the host fields.
  let user = await getCurrentUser();
  if (!user) {
    const email = d.hostEmail?.trim().toLowerCase();
    if (!email || !z.string().email().safeParse(email).success) {
      return { error: "Enter your email so we can manage your event" };
    }
    user = await findOrCreateUser(email, d.hostName);
    await createSession(user.id);
  }

  // The form sends wall-clock strings; interpret them in the event's own
  // timezone, never the server's. See zonedTimeToUtc.
  const timezone = isValidTimeZone(d.timezone)
    ? d.timezone
    : "America/Los_Angeles";

  const start = zonedTimeToUtc(d.startAt, timezone);
  if (Number.isNaN(start.getTime())) return { error: "Invalid start time" };
  const end = d.endAt ? zonedTimeToUtc(d.endAt, timezone) : null;

  // Every event belongs to an org. With no picker yet this is always the
  // creator's personal org — invisible to them, but the row is correct.
  const organization = await defaultOrganizationFor(user);

  const slug = nanoid(8);
  const [event] = await db
    .insert(events)
    .values({
      slug,
      organizationId: organization.id,
      title: d.title,
      description: d.description ?? "",
      themeColor: d.themeColor,
      coverPattern: d.coverPattern,
      startAt: start,
      endAt: end && !Number.isNaN(end.getTime()) ? end : null,
      timezone,
      locationType: d.locationType,
      locationName: d.locationName || null,
      locationAddress: d.locationAddress || null,
      locationUrl: d.locationUrl || null,
      hideAddress: d.requiresApproval,
      visibility: d.visibility,
      category: d.category || null,
      capacity: d.capacity ?? null,
      requiresApproval: d.requiresApproval,
      hostId: user.id,
    })
    .returning();

  await db.insert(tickets).values({
    eventId: event.id,
    name: d.priceType === "paid" ? "Standard" : "Free",
    price: d.priceType === "paid" ? (d.price ?? 0) : 0,
    sortOrder: 0,
  });

  await db.insert(eventHosts).values({
    eventId: event.id,
    userId: user.id,
    role: "host",
  });

  revalidatePath("/discover");
  revalidatePath("/home");
  redirect(`/${slug}`);
}
