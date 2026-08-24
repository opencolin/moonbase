import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import {
  organizationMembers,
  organizations,
  type OrgRole,
  type User,
} from "@/db/schema";

/**
 * Organizations own everything billable, role-scoped, or co-organized.
 *
 * The design constraint that matters: a solo organizer must never meet the
 * concept. Every user silently gets a personal org, and the UI only offers
 * org switching once `listOrganizations` returns something non-personal.
 */

const RESERVED_SLUGS = new Set([
  "api",
  "app",
  "c",
  "calendar",
  "create",
  "discover",
  "event",
  "events",
  "help",
  "home",
  "new",
  "org",
  "organizations",
  "pricing",
  "privacy",
  "security",
  "settings",
  "signin",
  "signout",
  "terms",
]);

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Find a free slug near `base`, falling back to a random suffix. */
async function uniqueSlug(base: string) {
  const root = slugify(base) || "org";
  const candidates = RESERVED_SLUGS.has(root) ? [] : [root];
  for (let i = 2; i <= 5; i++) candidates.push(`${root}-${i}`);

  for (const candidate of candidates) {
    const taken = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, candidate))
      .get();
    if (!taken) return candidate;
  }
  return `${root}-${nanoid(6).toLowerCase()}`;
}

/* ---------------------------- Reads ------------------------------- */

export async function getOrganizationBySlug(slug: string) {
  return (
    (await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .get()) ?? null
  );
}

export async function getOrganization(id: string) {
  return (
    (await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .get()) ?? null
  );
}

/** Every org the user belongs to, with their role. */
export async function listOrganizations(userId: string) {
  return db
    .select({
      organization: organizations,
      role: organizationMembers.role,
    })
    .from(organizationMembers)
    .innerJoin(
      organizations,
      eq(organizations.id, organizationMembers.organizationId),
    )
    .where(eq(organizationMembers.userId, userId));
}

/**
 * Orgs worth showing in a switcher — i.e. real ones. Returns empty for a
 * user who only has their personal org, which is how the UI stays quiet.
 */
export async function listSwitchableOrganizations(userId: string) {
  return db
    .select({
      organization: organizations,
      role: organizationMembers.role,
    })
    .from(organizationMembers)
    .innerJoin(
      organizations,
      eq(organizations.id, organizationMembers.organizationId),
    )
    .where(
      and(
        eq(organizationMembers.userId, userId),
        ne(organizations.isPersonal, true),
      ),
    );
}

export async function getPersonalOrganization(userId: string) {
  const row = await db
    .select({ organization: organizations })
    .from(organizationMembers)
    .innerJoin(
      organizations,
      eq(organizations.id, organizationMembers.organizationId),
    )
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizations.isPersonal, true),
      ),
    )
    .get();
  return row?.organization ?? null;
}

export async function getMembership(organizationId: string, userId: string) {
  return (
    (await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, userId),
        ),
      )
      .get()) ?? null
  );
}

export async function hasOrgRole(
  organizationId: string,
  userId: string,
  allowed: OrgRole[],
) {
  const membership = await getMembership(organizationId, userId);
  if (!membership) return false;
  return allowed.includes(membership.role as OrgRole);
}

export async function listMembers(organizationId: string) {
  return db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.organizationId, organizationId));
}

/* ---------------------------- Writes ------------------------------ */

export async function addMember(
  organizationId: string,
  userId: string,
  role: OrgRole = "member",
) {
  const existing = await getMembership(organizationId, userId);
  if (existing) return existing;
  const [created] = await db
    .insert(organizationMembers)
    .values({ organizationId, userId, role })
    .returning();
  return created;
}

export async function createOrganization(opts: {
  name: string;
  ownerId: string;
  slug?: string;
  description?: string | null;
  avatarUrl?: string | null;
  isPersonal?: boolean;
}) {
  const slug = opts.slug
    ? await uniqueSlug(opts.slug)
    : await uniqueSlug(opts.name);

  const [organization] = await db
    .insert(organizations)
    .values({
      slug,
      name: opts.name,
      description: opts.description ?? null,
      avatarUrl: opts.avatarUrl ?? null,
      isPersonal: opts.isPersonal ?? false,
    })
    .returning();

  await addMember(organization.id, opts.ownerId, "owner");
  return organization;
}

/**
 * Idempotent: returns the user's personal org, creating it on first call.
 * Safe to invoke on every sign-in — it's one indexed read in the hot path.
 */
export async function ensurePersonalOrganization(
  user: Pick<User, "id" | "name" | "email" | "avatarUrl">,
) {
  const existing = await getPersonalOrganization(user.id);
  if (existing) return existing;

  return createOrganization({
    name: user.name,
    ownerId: user.id,
    slug: user.name || user.email.split("@")[0],
    avatarUrl: user.avatarUrl ?? null,
    isPersonal: true,
  });
}

/**
 * The org a new event should belong to when the user hasn't picked one.
 * Today that's always the personal org; once real orgs exist this is where
 * a "last used org" preference would land.
 */
export async function defaultOrganizationFor(
  user: Pick<User, "id" | "name" | "email" | "avatarUrl">,
) {
  return ensurePersonalOrganization(user);
}
