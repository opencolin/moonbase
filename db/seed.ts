import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { nanoid } from "nanoid";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "file:./luma.db";
const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
const db = drizzle(client, { schema });

const DAY = 86_400_000;
const HOUR = 3_600_000;
// Anchor to the moment of seeding so demo events are always current.
const NOW = Date.now();
const at = (days: number, hour = 18) =>
  new Date(NOW + days * DAY - (new Date(NOW).getHours() - hour) * HOUR);

async function main() {
  console.log("→ Seeding Luma demo data…");

  // Idempotent reset. FK cascades are off, so children go before parents.
  await db.delete(schema.scores);
  await db.delete(schema.judgeAssignments);
  await db.delete(schema.judgingCriteria);
  await db.delete(schema.judges);
  await db.delete(schema.submissionValues);
  await db.delete(schema.submissionMedia);
  await db.delete(schema.submissions);
  await db.delete(schema.submissionFields);
  await db.delete(schema.teamJoinRequests);
  await db.delete(schema.teamSkills);
  await db.delete(schema.teamMembers);
  await db.delete(schema.teams);
  await db.delete(schema.participants);
  await db.delete(schema.tracks);
  await db.delete(schema.lumaLinks);
  await db.delete(schema.userSkills);
  await db.delete(schema.skills);
  await db.delete(schema.registrations);
  await db.delete(schema.eventHosts);
  await db.delete(schema.tickets);
  await db.delete(schema.events);
  await db.delete(schema.calendarSubscriptions);
  await db.delete(schema.calendars);
  await db.delete(schema.sessions);
  // FK cascades are not enforced on this connection, so org membership has
  // to go before the users and orgs it points at.
  await db.delete(schema.organizationMembers);
  await db.delete(schema.organizations);
  await db.delete(schema.users);

  /* --------------------------- Users --------------------------- */
  const usersData = [
    { name: "Ada Chen", email: "ada@luma.dev", bio: "Building communities in SF." },
    { name: "Marco Reyes", email: "marco@luma.dev", bio: "Designer & event host." },
    { name: "Priya Nair", email: "priya@luma.dev", bio: "Climate tech organizer." },
    { name: "Jordan Blake", email: "jordan@luma.dev", bio: "DJ and night owl." },
    { name: "Sora Tanaka", email: "sora@luma.dev", bio: "Runs the design guild." },
    { name: "You", email: "you@example.com", bio: "Welcome to your Luma clone." },
  ];
  const users = await db
    .insert(schema.users)
    .values(
      usersData.map((u) => ({
        ...u,
        avatarUrl: null,
      })),
    )
    .returning();
  const byEmail = (e: string) => users.find((u) => u.email === e)!;

  /* ---------------------- Organizations ------------------------ */
  // Every user gets a personal org — the same thing findOrCreateUser does
  // in the app. Nothing in the seeded UI surfaces them.
  const orgs = await db
    .insert(schema.organizations)
    .values(
      users.map((u) => ({
        slug: u.email.split("@")[0].replace(/[^a-z0-9]+/g, "-"),
        name: u.name,
        avatarUrl: u.avatarUrl ?? null,
        isPersonal: true,
      })),
    )
    .returning();

  await db.insert(schema.organizationMembers).values(
    users.map((u, i) => ({
      organizationId: orgs[i].id,
      userId: u.id,
      role: "owner",
    })),
  );

  const orgOf = (email: string) => orgs[users.findIndex((u) => u.email === email)];

  /* ------------------------- Calendars ------------------------- */
  const calendars = await db
    .insert(schema.calendars)
    .values([
      {
        slug: "sf-tech",
        name: "SF Tech Week",
        description:
          "The best technology meetups, talks and hack nights across San Francisco.",
        color: "blue",
        ownerId: byEmail("ada@luma.dev").id,
        organizationId: orgOf("ada@luma.dev").id,
      },
      {
        slug: "design-guild",
        name: "Design Guild",
        description: "Portfolio reviews, critiques and design jams.",
        color: "purple",
        ownerId: byEmail("sora@luma.dev").id,
        organizationId: orgOf("sora@luma.dev").id,
      },
      {
        slug: "climate-collective",
        name: "Climate Collective",
        description: "Founders and builders working on the climate.",
        color: "green",
        ownerId: byEmail("priya@luma.dev").id,
        organizationId: orgOf("priya@luma.dev").id,
      },
    ])
    .returning();
  const cal = (slug: string) => calendars.find((c) => c.slug === slug)!;

  /* --------------------------- Events -------------------------- */
  type Seed = {
    title: string;
    description: string;
    days: number;
    hour?: number;
    durationH?: number;
    theme: string;
    pattern: string;
    category: string;
    locationName: string;
    locationAddress: string;
    locationType?: string;
    host: string;
    calendar?: string;
    capacity?: number;
    requiresApproval?: boolean;
    tickets?: { name: string; price: number; description?: string }[];
  };

  const seeds: Seed[] = [
    {
      title: "Cafe Cursor San Francisco",
      description:
        "Join us at Cafe Cursor!\n\nWe're taking over a cafe in North Beach and inviting Cursor users to come hang. Bring your laptop and we'll spend some time building with other Cursor users — free coffee and pastries on us.\n\nDrop by anytime between 10am and 8pm. Come for an hour, come for the whole day.",
      days: 1,
      hour: 10,
      durationH: 10,
      theme: "orange",
      pattern: "aurora",
      category: "Tech",
      locationName: "North Beach Cafe",
      locationAddress: "1600 Stockton St, San Francisco, CA",
      host: "ada@luma.dev",
      calendar: "sf-tech",
      tickets: [
        { name: "General Admission", price: 0, description: "Drop in any time." },
        { name: "Builder (limited)", price: 0, description: "Reserved desk + power for the day." },
      ],
    },
    {
      title: "Friday Night Rooftop Sessions",
      description:
        "Sunset, good people and a curated house set as the city lights come on. Limited capacity — grab a spot early.",
      days: 3,
      hour: 19,
      durationH: 5,
      theme: "rose",
      pattern: "mesh",
      category: "Music",
      locationName: "The Pearl Rooftop",
      locationAddress: "601 19th St, San Francisco, CA",
      host: "jordan@luma.dev",
      capacity: 120,
      tickets: [
        { name: "Early Bird", price: 15 },
        { name: "Door", price: 25 },
      ],
    },
    {
      title: "Design Portfolio Review Night",
      description:
        "Bring your portfolio (or a single project) and get live feedback from senior designers. Small groups, friendly critique, lots of sticky notes.",
      days: 5,
      hour: 18,
      durationH: 3,
      theme: "purple",
      pattern: "rings",
      category: "Design",
      locationName: "Figma HQ",
      locationAddress: "760 Market St, San Francisco, CA",
      host: "sora@luma.dev",
      calendar: "design-guild",
      capacity: 60,
      requiresApproval: true,
      tickets: [{ name: "Reviewee", price: 0 }, { name: "Observer", price: 0 }],
    },
    {
      title: "Climate Builders Breakfast",
      description:
        "Founders working on climate tech meet over coffee and pastries. Short intros, then open conversation. No pitches, just builders.",
      days: 8,
      hour: 8,
      durationH: 2,
      theme: "green",
      pattern: "grid",
      category: "Climate",
      locationName: "Sightglass Coffee",
      locationAddress: "270 7th St, San Francisco, CA",
      host: "priya@luma.dev",
      calendar: "climate-collective",
      tickets: [{ name: "Free", price: 0 }],
    },
    {
      title: "Intro to Local-First Apps",
      description:
        "A hands-on workshop on building apps that work offline and sync seamlessly. Bring a laptop. We'll build a tiny app together with SQLite + sync.",
      days: 10,
      hour: 17,
      durationH: 3,
      theme: "teal",
      pattern: "aurora",
      category: "Tech",
      locationName: "Online",
      locationAddress: "",
      locationType: "online",
      host: "ada@luma.dev",
      calendar: "sf-tech",
      tickets: [{ name: "Free", price: 0 }],
    },
    {
      title: "Long Table Supper Club",
      description:
        "One long table, twelve strangers, four courses. A slow dinner designed for real conversation. Dietary needs? Let us know after you register.",
      days: 14,
      hour: 19,
      durationH: 4,
      theme: "amber",
      pattern: "confetti",
      category: "Food & Drink",
      locationName: "A private loft",
      locationAddress: "Mission District, San Francisco, CA",
      host: "marco@luma.dev",
      capacity: 12,
      requiresApproval: true,
      tickets: [{ name: "Seat at the table", price: 65 }],
    },
    {
      title: "Morning Run Club: Embarcadero",
      description:
        "A relaxed 5k along the water to start your weekend. All paces welcome. We grab coffee after.",
      days: 6,
      hour: 8,
      durationH: 1,
      theme: "blue",
      pattern: "mesh",
      category: "Fitness",
      locationName: "Ferry Building",
      locationAddress: "1 Ferry Building, San Francisco, CA",
      host: "priya@luma.dev",
      tickets: [{ name: "Free", price: 0 }],
    },
    {
      title: "AI Hack Night #12",
      description:
        "Build something with AI in three hours and demo it. Prizes, pizza, and a very supportive crowd. Solo or teams welcome.",
      days: 12,
      hour: 18,
      durationH: 4,
      theme: "indigo",
      pattern: "rings",
      category: "Tech",
      locationName: "GitHub HQ",
      locationAddress: "88 Colin P Kelly Jr St, San Francisco, CA",
      host: "ada@luma.dev",
      calendar: "sf-tech",
      capacity: 200,
      tickets: [
        { name: "Hacker", price: 0 },
        { name: "Mentor", price: 0 },
      ],
    },
    {
      title: "Vinyl & Natural Wine",
      description:
        "We spin records, you sip natural wine. A cozy evening of analog sound and good company.",
      days: 19,
      hour: 20,
      durationH: 4,
      theme: "rose",
      pattern: "aurora",
      category: "Music",
      locationName: "Bar Part Time",
      locationAddress: "496 14th St, San Francisco, CA",
      host: "jordan@luma.dev",
      tickets: [{ name: "Entry", price: 10 }],
    },
    {
      title: "Founders & Coffee (Past)",
      description:
        "Our monthly founders meetup. This one already happened — thanks to everyone who came!",
      days: -5,
      hour: 9,
      durationH: 2,
      theme: "green",
      pattern: "grid",
      category: "Tech",
      locationName: "Réveille Coffee",
      locationAddress: "200 Columbus Ave, San Francisco, CA",
      host: "priya@luma.dev",
      calendar: "climate-collective",
      tickets: [{ name: "Free", price: 0 }],
    },
  ];

  for (const s of seeds) {
    const start = at(s.days, s.hour ?? 18);
    const [event] = await db
      .insert(schema.events)
      .values({
        slug: nanoid(8),
        title: s.title,
        description: s.description,
        themeColor: s.theme,
        coverPattern: s.pattern,
        category: s.category,
        startAt: start,
        endAt: new Date(start.getTime() + (s.durationH ?? 2) * HOUR),
        locationType: s.locationType ?? "physical",
        locationName: s.locationName,
        locationAddress: s.locationAddress,
        hideAddress: s.requiresApproval ?? false,
        capacity: s.capacity ?? null,
        requiresApproval: s.requiresApproval ?? false,
        hostId: byEmail(s.host).id,
        organizationId: orgOf(s.host).id,
        calendarId: s.calendar ? cal(s.calendar).id : null,
      })
      .returning();

    const ticketRows = (s.tickets ?? [{ name: "Free", price: 0 }]).map(
      (t, i) => ({
        eventId: event.id,
        name: t.name,
        price: t.price,
        description: t.description ?? null,
        sortOrder: i,
      }),
    );
    const insertedTickets = await db
      .insert(schema.tickets)
      .values(ticketRows)
      .returning();

    await db.insert(schema.eventHosts).values({
      eventId: event.id,
      userId: byEmail(s.host).id,
      role: "host",
    });

    // Sprinkle in some attendees so guest counts look alive.
    const goingCount = Math.min(
      s.capacity ?? 40,
      6 + Math.floor((s.title.length * 7) % 38),
    );
    const regs = Array.from({ length: goingCount }, (_, i) => ({
      eventId: event.id,
      ticketId: insertedTickets[0].id,
      userId: null,
      name: `Guest ${i + 1}`,
      email: `guest${i + 1}.${nanoid(4)}@example.com`,
      status: s.days < 0 ? "going" : "going",
    }));
    if (regs.length) await db.insert(schema.registrations).values(regs);
  }

  /* ------------------------- Hackathon -------------------------- */
  // A hackathon-mode event, modelled on The Physical AI Sprint, so the
  // v1 surfaces (tracks, teams, builders, submissions, judging) have real
  // data. Every other seeded event stays a plain meetup and shows none of it.
  const hackStart = at(6, 9);
  const [hack] = await db
    .insert(schema.events)
    .values({
      slug: "physical-ai-sprint",
      title: "The Physical AI Sprint",
      description:
        "A hackathon at the intersection of AI and the physical world. Start with technical workshops on the tools and challenge space, then form a team—or work solo—and build a working prototype.",
      themeColor: "teal",
      coverPattern: "grid",
      category: "Tech",
      startAt: hackStart,
      endAt: new Date(hackStart.getTime() + 2 * DAY),
      locationType: "physical",
      locationName: "717 Market Street",
      locationAddress: "717 Market St, San Francisco, CA",
      capacity: 150,
      hostId: byEmail("ada@luma.dev").id,
      organizationId: orgOf("ada@luma.dev").id,
      hackathonMode: true,
      minTeamSize: 1,
      maxTeamSize: 5,
      submissionDeadline: new Date(hackStart.getTime() + 2 * DAY - 2 * HOUR),
    })
    .returning();

  await db.insert(schema.tickets).values({
    eventId: hack.id,
    name: "Builder",
    price: 0,
    sortOrder: 0,
  });
  await db.insert(schema.eventHosts).values({
    eventId: hack.id,
    userId: byEmail("ada@luma.dev").id,
    role: "host",
  });

  const trackRows = await db
    .insert(schema.tracks)
    .values([
      {
        eventId: hack.id,
        slug: "perception",
        name: "Perception (Sense)",
        description:
          "Ingesting and interpreting multi-modal sensor data such as RGB-D video and LiDAR.",
        sortOrder: 0,
      },
      {
        eventId: hack.id,
        slug: "reasoning",
        name: "Reasoning (Think)",
        description:
          "AI that analyzes constraints, plans ahead, and adapts to real-world change.",
        sortOrder: 1,
      },
      {
        eventId: hack.id,
        slug: "action",
        name: "Action (Act)",
        description:
          "Translating cognitive plans into physical action: robots, drones and IoT.",
        sortOrder: 2,
      },
    ])
    .returning();
  const track = (slug: string) => trackRows.find((t) => t.slug === slug)!;

  // Submission requirements — the Sprint's own set, shipped as the default.
  await db.insert(schema.submissionFields).values([
    { eventId: hack.id, label: "Project Name", type: "short_text", required: true, sortOrder: 0 },
    { eventId: hack.id, label: "Description", type: "long_text", required: true, sortOrder: 1 },
    { eventId: hack.id, label: "Github", type: "url", required: true, sortOrder: 2 },
    { eventId: hack.id, label: "Demo Video", type: "url", required: true, sortOrder: 3 },
    { eventId: hack.id, label: "Pitch Deck", type: "url", required: true, sortOrder: 4 },
  ]);

  await db.insert(schema.judgingCriteria).values([
    { eventId: hack.id, name: "Technical Skill", weight: 25, sortOrder: 0 },
    { eventId: hack.id, name: "Creativity", weight: 25, sortOrder: 1 },
    { eventId: hack.id, name: "Completeness", weight: 25, sortOrder: 2 },
    { eventId: hack.id, name: "Impact", weight: 25, sortOrder: 3 },
  ]);

  // Participants: everyone except the host, so the directory has bodies.
  const builderEmails = usersData.map((u) => u.email);
  await db.insert(schema.participants).values(
    builderEmails.map((email, i) => ({
      eventId: hack.id,
      userId: byEmail(email).id,
      // The unattached ones advertise themselves.
      lookingForTeam: i >= 3,
      githubUrl: i % 2 === 0 ? `https://github.com/${email.split("@")[0]}` : null,
    })),
  );

  // Two teams: one with room, one closed.
  const [teamA] = await db
    .insert(schema.teams)
    .values({
      eventId: hack.id,
      trackId: track("perception").id,
      slug: "depth-charge",
      name: "Depth Charge",
      pitch: "Turning a cheap RGB-D camera into a room-scale occupancy map.",
      open: true,
    })
    .returning();
  await db.insert(schema.teamMembers).values([
    { teamId: teamA.id, userId: byEmail("marco@luma.dev").id, role: "captain" },
    { teamId: teamA.id, userId: byEmail("priya@luma.dev").id, role: "member" },
  ]);

  const [teamB] = await db
    .insert(schema.teams)
    .values({
      eventId: hack.id,
      trackId: track("action").id,
      slug: "last-mile",
      name: "Last Mile",
      pitch: "A drone that plans its own delivery route around obstacles.",
      open: false,
    })
    .returning();
  await db.insert(schema.teamMembers).values({
    teamId: teamB.id,
    userId: byEmail("ada@luma.dev").id,
    role: "captain",
  });

  // Registrations for the hackathon: the six real users (so the attendee
  // sheet's team columns have something to join against) plus walk-ins.
  const hackTicket = await db
    .select()
    .from(schema.tickets)
    .where(eq(schema.tickets.eventId, hack.id))
    .get();

  await db.insert(schema.registrations).values([
    ...usersData.map((u, i) => ({
      eventId: hack.id,
      ticketId: hackTicket!.id,
      userId: byEmail(u.email).id,
      name: u.name,
      email: u.email,
      status: i === 5 ? "pending" : "going",
    })),
    ...Array.from({ length: 14 }, (_, i) => ({
      eventId: hack.id,
      ticketId: hackTicket!.id,
      userId: null,
      name: `Builder ${i + 1}`,
      email: `builder${i + 1}@example.com`,
      status: i < 11 ? "going" : i < 13 ? "pending" : "waitlist",
    })),
  ]);

  const counts = {
    users: users.length,
    calendars: calendars.length,
    events: seeds.length + 1,
  };
  console.log(
    `✓ Seeded ${counts.events} events (1 hackathon, 3 tracks, 2 teams), ${counts.calendars} calendars, ${counts.users} users`,
  );
  client.close();
}

main().catch((err) => {
  console.error("✗ Seed failed:", err);
  process.exit(1);
});
