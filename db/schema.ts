/**
 * Every column here is built from the primitives in `./columns`. Nothing in
 * this file should import from `drizzle-orm/sqlite-core` directly — that's
 * what keeps the Postgres port a single-file change. See columns.ts.
 */
import { primaryKey, uniqueIndex } from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";
import {
  bool,
  createdAt,
  fk,
  int,
  money,
  pk,
  str,
  table,
  timestamp,
} from "./columns";

/* ----------------------------- Users ----------------------------- */
export const users = table("users", {
  id: pk(),
  email: str("email").notNull().unique(),
  name: str("name").notNull(),
  avatarUrl: str("avatar_url"),
  bio: str("bio"),
  createdAt: createdAt(),
});

/* ---------------------------- Sessions ---------------------------- */
export const sessions = table("sessions", {
  id: str("id").primaryKey(), // opaque session token
  userId: fk("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: createdAt(),
});

/* ------------------------- Organizations -------------------------- */
// Everything billable, role-scoped, or co-organized hangs off an org.
//
// Every user gets a *personal* org the first time we see them. A solo
// organizer must never encounter the concept: the UI only surfaces org
// switching once someone belongs to a second, non-personal org.
export const organizations = table("organizations", {
  id: pk(),
  slug: str("slug").notNull().unique(),
  name: str("name").notNull(),
  avatarUrl: str("avatar_url"),
  description: str("description"),
  isPersonal: bool("is_personal").notNull().default(false),
  createdAt: createdAt(),
});

// role: "owner" | "admin" | "member"
// Event-level roles override these per event.
export const organizationMembers = table(
  "organization_members",
  {
    organizationId: fk("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: fk("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: str("role").notNull().default("member"),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.organizationId, t.userId] })],
);

/* --------------------------- Calendars ---------------------------- */
// A calendar is a host page that groups events (e.g. "Cursor Community").
export const calendars = table("calendars", {
  id: pk(),
  slug: str("slug").notNull().unique(),
  name: str("name").notNull(),
  description: str("description"),
  avatarUrl: str("avatar_url"),
  coverUrl: str("cover_url"),
  color: str("color").notNull().default("indigo"),
  ownerId: fk("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // Nullable in the DB only so the column could be added to existing
  // SQLite tables without a rebuild; treat it as required in app code.
  // Make it NOT NULL on the Postgres port.
  organizationId: fk("organization_id").references(() => organizations.id, {
    onDelete: "cascade",
  }),
  createdAt: createdAt(),
});

export const calendarSubscriptions = table(
  "calendar_subscriptions",
  {
    calendarId: fk("calendar_id")
      .notNull()
      .references(() => calendars.id, { onDelete: "cascade" }),
    userId: fk("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.calendarId, t.userId] })],
);

/* ----------------------------- Events ----------------------------- */
export const events = table("events", {
  id: pk(),
  // Short public URL slug, e.g. lu.ma/a1b2c3d4
  slug: str("slug")
    .notNull()
    .unique()
    .$defaultFn(() => nanoid(8)),
  title: str("title").notNull(),
  description: str("description").default(""),
  coverUrl: str("cover_url"),
  // Theme color key used to tint the event page (matches accent palette)
  themeColor: str("theme_color").notNull().default("indigo"),
  // Visual style of the auto-generated cover when no image is set
  coverPattern: str("cover_pattern").notNull().default("aurora"),

  startAt: timestamp("start_at").notNull(),
  endAt: timestamp("end_at"),
  timezone: str("timezone").notNull().default("America/Los_Angeles"),

  // location: "physical" | "online" | "tbd"
  locationType: str("location_type").notNull().default("physical"),
  locationName: str("location_name"),
  locationAddress: str("location_address"),
  locationUrl: str("location_url"),
  // Reveal exact address only after registering
  hideAddress: bool("hide_address").notNull().default(false),

  // visibility: "public" | "unlisted"
  visibility: str("visibility").notNull().default("public"),
  category: str("category"),
  capacity: int("capacity"),
  requiresApproval: bool("requires_approval").notNull().default(false),

  /* --- hackathon mode (v1) ---------------------------------------
   * Off by default, and everything it unlocks — tracks, teams,
   * submissions, judging — stays completely invisible until it's on.
   * A plain meetup must never meet any of these concepts. */
  /** Secret for the read-only CSV feed Google Sheets pulls via IMPORTDATA.
   *  Null until the organizer connects a sheet; rotating it kills the link. */
  feedToken: str("feed_token"),

  hackathonMode: bool("hackathon_mode").notNull().default(false),
  minTeamSize: int("min_team_size"),
  maxTeamSize: int("max_team_size"),
  submissionDeadline: timestamp("submission_deadline"),

  // The human who created it — kept for display ("hosted by").
  hostId: fk("host_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // The org that *owns* it — billing, roles, co-organizers.
  // Nullable for the same migration reason as calendars above.
  organizationId: fk("organization_id").references(() => organizations.id, {
    onDelete: "cascade",
  }),
  calendarId: fk("calendar_id").references(() => calendars.id, {
    onDelete: "set null",
  }),

  createdAt: createdAt(),
});

/* ----------------------------- Tickets ---------------------------- */
export const tickets = table("tickets", {
  id: pk(),
  eventId: fk("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  name: str("name").notNull().default("Standard"),
  description: str("description"),
  // price in major currency units (e.g. dollars). 0 == free.
  price: money("price").notNull().default(0),
  currency: str("currency").notNull().default("USD"),
  capacity: int("capacity"),
  sortOrder: int("sort_order").notNull().default(0),
});

/* -------------------------- Registrations ------------------------- */
// status: "going" | "pending" | "waitlist" | "declined"
export const registrations = table("registrations", {
  id: pk(),
  eventId: fk("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  userId: fk("user_id").references(() => users.id, { onDelete: "set null" }),
  ticketId: fk("ticket_id").references(() => tickets.id, {
    onDelete: "set null",
  }),
  name: str("name").notNull(),
  email: str("email").notNull(),
  guestCount: int("guest_count").notNull().default(0),
  status: str("status").notNull().default("going"),
  createdAt: createdAt(),
});

/* ----------------------- Event co-hosts (M:N) --------------------- */
export const eventHosts = table(
  "event_hosts",
  {
    eventId: fk("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: fk("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // role: "host" | "cohost"
    role: str("role").notNull().default("cohost"),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.userId] })],
);

/* ============================== v1 =============================== */

/* ----------------------------- Tracks ----------------------------- */
// Optional categories inside an event, like AI or Climate. Teams pick one
// when they join; the form, submissions, judging and team size stay shared
// across the event. An event with no tracks is the default and works fully.
export const tracks = table(
  "tracks",
  {
    id: pk(),
    eventId: fk("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    slug: str("slug").notNull(),
    name: str("name").notNull(),
    description: str("description"),
    icon: str("icon"),
    sortOrder: int("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("tracks_event_slug_idx").on(t.eventId, t.slug)],
);

/* ----------------------------- Skills ----------------------------- */
export const skills = table("skills", {
  id: pk(),
  slug: str("slug").notNull().unique(),
  name: str("name").notNull(),
});

export const userSkills = table(
  "user_skills",
  {
    userId: fk("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    skillId: fk("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.skillId] })],
);

/* ----------------------------- Teams ------------------------------ */
export const teams = table(
  "teams",
  {
    id: pk(),
    eventId: fk("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    trackId: fk("track_id").references(() => tracks.id, {
      onDelete: "set null",
    }),
    slug: str("slug").notNull(),
    name: str("name").notNull(),
    pitch: str("pitch"),
    // Whether the team is accepting members. "Full" is computed from the
    // event's max team size, not stored, so the two can't drift.
    open: bool("open").notNull().default(true),
    contact: str("contact"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("teams_event_slug_idx").on(t.eventId, t.slug)],
);

// role: "captain" | "member"
export const teamMembers = table(
  "team_members",
  {
    teamId: fk("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: fk("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: str("role").notNull().default("member"),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.teamId, t.userId] })],
);

// status: "pending" | "accepted" | "declined"
export const teamJoinRequests = table(
  "team_join_requests",
  {
    id: pk(),
    teamId: fk("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: fk("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    message: str("message"),
    status: str("status").notNull().default("pending"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("team_join_team_user_idx").on(t.teamId, t.userId)],
);

// kind: "looking" | "have"
export const teamSkills = table(
  "team_skills",
  {
    teamId: fk("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    skillId: fk("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    kind: str("kind").notNull().default("looking"),
  },
  (t) => [primaryKey({ columns: [t.teamId, t.skillId, t.kind] })],
);

/**
 * Per-event participation record. Distinct from `registrations`, which is
 * the Luma-shaped RSVP: a participant may RSVP without ever looking for a
 * team, and (once Luma sync lands) may exist here without a local
 * registration at all.
 */
export const participants = table(
  "participants",
  {
    id: pk(),
    eventId: fk("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: fk("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lookingForTeam: bool("looking_for_team").notNull().default(false),
    githubUrl: str("github_url"),
    websiteUrl: str("website_url"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("participants_event_user_idx").on(t.eventId, t.userId)],
);

/* -------------------------- Submissions --------------------------- */
// Field palette: "url" | "short_text" | "long_text" | "file"
// Scoped to an event, or to a track when trackId is set.
export const submissionFields = table("submission_fields", {
  id: pk(),
  eventId: fk("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  trackId: fk("track_id").references(() => tracks.id, { onDelete: "cascade" }),
  label: str("label").notNull(),
  type: str("type").notNull().default("short_text"),
  description: str("description"),
  required: bool("required").notNull().default(false),
  sortOrder: int("sort_order").notNull().default(0),
});

// status: "draft" | "submitted"
export const submissions = table(
  "submissions",
  {
    id: pk(),
    eventId: fk("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    teamId: fk("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    trackId: fk("track_id").references(() => tracks.id, {
      onDelete: "set null",
    }),
    slug: str("slug").notNull(),
    title: str("title").notNull(),
    tagline: str("tagline"),
    description: str("description").default(""),
    status: str("status").notNull().default("draft"),
    submittedAt: timestamp("submitted_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("submissions_event_slug_idx").on(t.eventId, t.slug)],
);

export const submissionValues = table(
  "submission_values",
  {
    submissionId: fk("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    fieldId: fk("field_id")
      .notNull()
      .references(() => submissionFields.id, { onDelete: "cascade" }),
    value: str("value"),
  },
  (t) => [primaryKey({ columns: [t.submissionId, t.fieldId] })],
);

// kind: "photo" | "video"
export const submissionMedia = table("submission_media", {
  id: pk(),
  submissionId: fk("submission_id")
    .notNull()
    .references(() => submissions.id, { onDelete: "cascade" }),
  kind: str("kind").notNull().default("photo"),
  url: str("url").notNull(),
  sortOrder: int("sort_order").notNull().default(0),
});

/* ---------------------------- Judging ----------------------------- */
export const judges = table(
  "judges",
  {
    id: pk(),
    eventId: fk("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: fk("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // null = scoped to the whole event
    trackId: fk("track_id").references(() => tracks.id, {
      onDelete: "cascade",
    }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("judges_event_user_idx").on(t.eventId, t.userId)],
);

export const judgingCriteria = table("judging_criteria", {
  id: pk(),
  eventId: fk("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  trackId: fk("track_id").references(() => tracks.id, { onDelete: "cascade" }),
  name: str("name").notNull(),
  description: str("description"),
  // Relative weight. Normalised at read time, so weights need not sum to 100.
  weight: int("weight").notNull().default(25),
  sortOrder: int("sort_order").notNull().default(0),
});

export const judgeAssignments = table(
  "judge_assignments",
  {
    judgeId: fk("judge_id")
      .notNull()
      .references(() => judges.id, { onDelete: "cascade" }),
    submissionId: fk("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.judgeId, t.submissionId] })],
);

/**
 * One row per (judge, submission, criterion).
 *
 * `value` is nullable **on purpose**: a blank score means "did not see this
 * team" and is excluded from the average rather than counted as zero. Never
 * coalesce this to 0 — see lib/judging.ts.
 */
export const scores = table(
  "scores",
  {
    judgeId: fk("judge_id")
      .notNull()
      .references(() => judges.id, { onDelete: "cascade" }),
    submissionId: fk("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    criterionId: fk("criterion_id")
      .notNull()
      .references(() => judgingCriteria.id, { onDelete: "cascade" }),
    value: int("value"),
    notes: str("notes"),
    updatedAt: timestamp("updated_at"),
  },
  (t) => [
    primaryKey({
      columns: [t.judgeId, t.submissionId, t.criterionId],
    }),
  ],
);

/* --------------------------- Luma sync ---------------------------- */
// Luma is the source of truth for *who registered*; Moonbase is the source
// of truth for *what they did*. Never let the two fight over a field.
export const lumaLinks = table(
  "luma_links",
  {
    id: pk(),
    eventId: fk("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    lumaEventId: str("luma_event_id").notNull(),
    // "idle" | "syncing" | "ok" | "error"
    syncState: str("sync_state").notNull().default("idle"),
    lastSyncedAt: timestamp("last_synced_at"),
    lastError: str("last_error"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("luma_links_event_idx").on(t.eventId)],
);

/* ----------------------------- Types ------------------------------ */
export type User = typeof users.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type OrgRole = "owner" | "admin" | "member";
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type Ticket = typeof tickets.$inferSelect;
export type Registration = typeof registrations.$inferSelect;
export type Calendar = typeof calendars.$inferSelect;

export type Track = typeof tracks.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type TeamMember = typeof teamMembers.$inferSelect;
export type TeamJoinRequest = typeof teamJoinRequests.$inferSelect;
export type Participant = typeof participants.$inferSelect;
export type Skill = typeof skills.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
export type SubmissionField = typeof submissionFields.$inferSelect;
export type SubmissionMedia = typeof submissionMedia.$inferSelect;
export type Judge = typeof judges.$inferSelect;
export type JudgingCriterion = typeof judgingCriteria.$inferSelect;
export type Score = typeof scores.$inferSelect;
export type LumaLink = typeof lumaLinks.$inferSelect;

export type SubmissionFieldType = "url" | "short_text" | "long_text" | "file";
export type TeamRole = "captain" | "member";
