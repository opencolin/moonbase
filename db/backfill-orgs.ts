/**
 * One-shot backfill for the organizations migration (v0.3).
 *
 * Gives every existing user a personal org, then points every existing
 * event and calendar at their creator's personal org. Idempotent — running
 * it twice is a no-op, so it's safe to re-run after a partial failure.
 *
 *   pnpm db:backfill-orgs
 *
 * Standalone (like seed.ts), so it re-implements the small bits of
 * lib/organizations.ts rather than importing that `server-only` module.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { and, eq, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "file:./luma.db";
const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
const db = drizzle(client, { schema });

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

async function uniqueSlug(base: string) {
  const root = slugify(base) || "org";
  for (const candidate of [root, ...[2, 3, 4, 5].map((n) => `${root}-${n}`)]) {
    const taken = await db
      .select({ id: schema.organizations.id })
      .from(schema.organizations)
      .where(eq(schema.organizations.slug, candidate))
      .get();
    if (!taken) return candidate;
  }
  return `${root}-${nanoid(6).toLowerCase()}`;
}

async function main() {
  console.log("→ Backfilling organizations…");

  /* ---------------- personal org for every user ---------------- */
  const allUsers = await db.select().from(schema.users);
  const personalOrgByUser = new Map<string, string>();
  let createdOrgs = 0;

  for (const user of allUsers) {
    const existing = await db
      .select({ org: schema.organizations })
      .from(schema.organizationMembers)
      .innerJoin(
        schema.organizations,
        eq(schema.organizations.id, schema.organizationMembers.organizationId),
      )
      .where(
        and(
          eq(schema.organizationMembers.userId, user.id),
          eq(schema.organizations.isPersonal, true),
        ),
      )
      .get();

    if (existing?.org) {
      personalOrgByUser.set(user.id, existing.org.id);
      continue;
    }

    const [org] = await db
      .insert(schema.organizations)
      .values({
        slug: await uniqueSlug(user.name || user.email.split("@")[0]),
        name: user.name,
        avatarUrl: user.avatarUrl ?? null,
        isPersonal: true,
      })
      .returning();

    await db.insert(schema.organizationMembers).values({
      organizationId: org.id,
      userId: user.id,
      role: "owner",
    });

    personalOrgByUser.set(user.id, org.id);
    createdOrgs++;
  }
  console.log(`  personal orgs: ${createdOrgs} created, ${allUsers.length} total users`);

  /* -------------------- attach calendars ----------------------- */
  const orphanCalendars = await db
    .select()
    .from(schema.calendars)
    .where(isNull(schema.calendars.organizationId));

  for (const calendar of orphanCalendars) {
    const orgId = personalOrgByUser.get(calendar.ownerId);
    if (!orgId) {
      console.warn(`  ! calendar ${calendar.slug} has no owner org — skipped`);
      continue;
    }
    await db
      .update(schema.calendars)
      .set({ organizationId: orgId })
      .where(eq(schema.calendars.id, calendar.id));
  }
  console.log(`  calendars attached: ${orphanCalendars.length}`);

  /* ---------------------- attach events ------------------------ */
  const orphanEvents = await db
    .select()
    .from(schema.events)
    .where(isNull(schema.events.organizationId));

  for (const event of orphanEvents) {
    const orgId = personalOrgByUser.get(event.hostId);
    if (!orgId) {
      console.warn(`  ! event ${event.slug} has no host org — skipped`);
      continue;
    }
    await db
      .update(schema.events)
      .set({ organizationId: orgId })
      .where(eq(schema.events.id, event.id));
  }
  console.log(`  events attached: ${orphanEvents.length}`);

  console.log("✓ Backfill complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
