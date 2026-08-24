# Moonbase — Product Requirements Document

**Status:** Draft v2 · 16 Aug 2026
**Owner:** Colin Lowenberg
**One-liner:** Luma's event experience, with the team formation, chat, and judging that hackathons actually need — and none of the setup burden.

---

## 1. Thesis

Luma won events by making the *page* beautiful and the *RSVP* one click. It stops at the door: once people are in the room, Luma has no idea that six of them are a team, that the team is building something, that a mentor is unblocking them, or that five judges need to score the result by 6pm.

Hackathon platforms solve the second half and lose the first. They are built as admin consoles, so the public page looks generic and organizers keep a separate site — and then keep a separate Discord, a separate spreadsheet, and a separate judging doc.

Moonbase is one product covering both halves: **a Luma-quality front door with a hackathon-grade back office, that an organizer can set up in an afternoon.**

### The wedge is simplicity, not features

The competitive read is clear: **BuilderBase is not the thing to beat on features — it is too complicated for organizers to even get an event set up.** A platform that can do everything but requires a week of configuration loses to a Luma page plus a Discord server, every time. That is the actual competitor: *Luma + Discord + Google Sheets + a judging doc.*

So the product principle that governs every decision below:

> **Time to a published event page must stay under five minutes, forever.**
> Every feature ships with a default that works. Configuration is progressive: an organizer who wants tracks, milestones, weighted rubrics, and multi-round judging can have them; an organizer who wants none of it must never see them.

The BuilderBase inventory in this document is an **inventory of what is possible**, not a checklist of what to match. Where we build the same thing, it is because organizers genuinely need it — and it must arrive simpler than theirs.

### Why now, for us specifically

We already own working code for both halves:

- `opencolin/luma-clone` — a faithful, self-hostable Luma with event pages, registration, discovery, host tools, and a live Luma API bridge. This is v0, effectively today.
- `buildspacetv/sprint` — a shipped hackathon site (The Physical AI Sprint) whose team directory, project showcase, and judging tool ran a real event. Its *domain model* is validated even though its storage (GitHub issues) is not.

---

## 2. Reference inputs

| Source | What it is | What we take |
|---|---|---|
| `opencolin/luma-clone` | Next.js 16 + Drizzle + libSQL Luma clone (private) | **The entire v0 base.** Codebase, schema, design system, Luma API bridge. |
| `buildspacetv/sprint` | Static site for The Physical AI Sprint; GitHub issues as datastore | **The v1 domain model.** Teams, projects, roster inheritance, judging rules. Storage layer is thrown away. |
| BuilderBase screenshots (`builderbase/`, 52 shots) | Competitor's full organizer console + participant surface | **A map of the problem space.** Useful for knowing what exists and what organizers eventually ask for. Not a parity target — see §1. |
| `buildspace/buildspace-os` | Chrome new-tab extension that iframes `buildspace.so/home` | **Nothing.** 31 lines of HTML wrapping an iframe. Reviewed and discarded — no product substance. |

> **Note on Sprint's storage.** Sprint keeps teams and submissions as GitHub issues, synced by an Action into `data/*.json` and rendered to static pages. That was the right call for a one-off event with no backend. It is the wrong call for a platform: no auth beyond GitHub, no private data, no real-time, and every write is a redeploy. Sprint's *schema and rules* graduate to Moonbase; its plumbing does not.

---

## 3. Decisions taken

These were open; they are now settled and the roadmap reflects them.

| # | Decision | Consequence |
|---|---|---|
| 1 | **Do not compete with BuilderBase on features.** Their setup burden is the opening. | Simplicity is a hard product constraint (§1), not a nice-to-have. Feature parity is explicitly *not* a goal. |
| 2 | **Open source when ready**, not on day one. | Keep the codebase license-clean and dependency-clean so the switch is a decision, not a project. No architecture that assumes a closed core. |
| 3 | **Luma integration is a key part of the solution**, not a nice integration. | Promoted from a late integration to **v1**. The pitch becomes "keep selling tickets on Luma, run the event on Moonbase" — near-zero switching cost. |
| 4 | **Index events across the web.** | Two payoffs: a recommended-events feed for users, and an intelligence layer identifying **organizers and sponsors** — our own GTM engine. Gets its own version (v6). |
| 5 | **AI judging round.** Multi-round judging is nice; the AI round is the real requirement. | v4 is built around it. Multi-round is the container the AI round needs anyway, so both ship together. |
| 6 | **Decide the org primitive early; do not copy BuilderBase's IA.** | `organizations` lands in v0.3 with our own URL shape and a personal org per user, so solo organizers never meet the concept. |

**Additional scope added:** in-product **chat** (to displace Discord) and a **mobile app**. Both are below.

---

## 4. Users and roles

| Role | Lives in | Cares about |
|---|---|---|
| **Attendee / Builder** | Public event page, own dashboard, mobile app | Finding the event, registering in one click, finding a team, getting unblocked, submitting |
| **Organizer** | Event console | Getting people registered, formed into teams, checked in, judged, and paid out — without spreadsheets |
| **Co-organizer** | Event console, scoped | Same, narrower permissions; often at a partner org |
| **Mentor** | Chat / help threads | Claiming and answering builder questions during the event |
| **Judge** | Judging tool (phone-first) | Scoring assigned submissions fast, at a noisy venue, on bad wifi |
| **Sponsor** | Sponsor dashboard (v7) | Logo placement, lead capture, code distribution, ROI proof |

Role assignment is **per-event and overrides org-level role** — someone can be an org Admin but only a Judge on one event.

---

## 5. Surfaces

1. **Marketing site** — `/`, the public front door
2. **Public event page** — `/[slug]`, the shareable artifact. Must not regress below Luma quality, ever.
3. **Discovery** — browse and, from v6, personalized recommendations
4. **Builder dashboard** — my events, my teams, my submissions, my profile
5. **Event console** — the organizer back office
6. **Chat** — event, track, and team channels; the Discord replacement (v3)
7. **Kiosk / door mode** — full-screen check-in scanner (v2)
8. **Judging tool** — separate, phone-first, offline-tolerant (v1)
9. **Mobile app** — participant and judge (v5)

---

## 6. v0 — The front door *(shipped, needs hardening)*

**Goal:** a self-hostable Luma that a stranger would mistake for the real thing.

### Already exists

- Marketing home with animated hero mockup
- Event pages: two-column layout, cover, hosts, date/time, ticket selection, registration, attendee list, map
- One-click registration: going / waitlist / approval, capacity limits, guest cookies
- Event creation: live cover preview, generated gradient covers (8 colors × 5 patterns), location types, free and paid tickets, approval toggle
- Discovery: categories, featured calendars, cities
- My Events dashboard: hosting and attending, upcoming/past
- Host tools: live stats, searchable guest list, approve/decline, copyable invite link
- Markdown event descriptions (GFM)
- Passwordless magic-link auth, session cookies
- **Live Luma API bridge** — set `LUMA_API_KEY` and the app mirrors a real Luma Plus calendar through the same view-model as local events

### Current schema

`users` · `sessions` · `calendars` · `calendar_subscriptions` · `events` · `tickets` · `registrations` · `event_hosts`

### Work remaining

| # | Item | Why now |
|---|---|---|
| v0.1 | **Calendar pages with subscribe** | Calendars are the primitive orgs and discovery hang off. |
| v0.2 | **Postgres path** | libSQL/SQLite is right for self-host, wrong for hosted multi-tenant. Keep Drizzle; make the dialect a config choice *before* the schema triples. |
| v0.3 | **Organizations** | Needed for billing, roles, and co-organizers. Every user gets a personal org silently — solo organizers must never encounter the concept (see §1). |
| v0.4 | **Email infrastructure** | v2–v4 add ~25 transactional emails. Build the template and rendering layer once. |
| v0.5 | **Timezone correctness audit** | Multi-day events across timezones; check-in windows and submission deadlines are unforgiving. Fix before deadlines exist. |

---

## 7. v1 — Teams, projects, judging, and Luma

**Goal:** run a hackathon end-to-end — and let organizers keep selling tickets wherever they already do.

This is the version that would have replaced `buildspacetv/sprint` for The Physical AI Sprint. Scope is deliberately narrow: **teams, submissions, judging, Luma sync.** No page builder, no analytics, no chat yet.

### 7.1 Luma integration — *P0, strategic*

Per decision 3, this is the wedge, not an integration.

- **Two-way sync with a Luma event** — pull registrations and attendees continuously; a Moonbase event can be *backed by* a Luma event rather than replacing it
- **Zero switching cost pitch:** the organizer changes nothing about how they sell tickets. Their Luma page stays canonical. Moonbase adds teams, submissions, and judging on top.
- Builds directly on the working read-side bridge in v0
- **Opt-in write-back** (`event/add-guests`) becomes worth building here — once Moonbase handles admissions, guests need to flow back
- Failure mode to design for: Luma is the source of truth for *who registered*; Moonbase is the source of truth for *what they did*. Never let the two fight over the same field.

### 7.2 Tracks

An optional category inside an event. The framing worth keeping:

> Optional categories inside an event, like AI or Climate. Teams pick one when they join — the form, submissions, judging and team size stay shared across the event.

Tracks carry participant and team counts. Most console views eventually get an *All Tracks* filter; build that filter primitive here. **Default: no tracks.** An organizer who never opens the tracks page gets a working single-track event.

### 7.3 Teams

A team belongs to an event, has a roster, a pitch, and an open/closed state.

Ported from Sprint, with issue-tracker mechanics replaced:

| Sprint behavior | Moonbase v1 |
|---|---|
| Team = open GitHub issue labelled `team` | `teams` row scoped to an event |
| Join by commenting on the issue | Join request → captain approves; open teams accept directly |
| "Marking a team full drops it out of the has-room filter" | `open` boolean + `full` computed from event's max team size |
| `looking[]` / `have[]` skill arrays | Skill tags on teams and member profiles; drives matching |
| Roster edited into the issue body | Real membership table with roles |

- **Team directory** — post a team, find one with room, search by skill or person. Filters: *All · Looking for members · Closed · Full*.
- **Builder directory** — *All builders · Looking for team · In a team*. A builder flags themselves "looking for team" and becomes discoverable by skill.
- **Team size limits** — event setting (min/max), enforced at join.

### 7.4 Projects / submissions

Ported from Sprint:

- Fields: title, tagline, description (markdown), track, links, media
- **Media handling** — any `https://` image URL; the first photo becomes the showcase cover and `og:image`; YouTube/Vimeo/Loom become embeds; `.mp4`/`.webm`/`.mov` render natively; non-`https://` URLs are dropped. *Battle-tested — port it directly.*
- **Roster inheritance** — a blank members field inherits the team roster. Sprint's reasoning holds: nobody types the same people twice and the two rosters cannot drift.
- **Explicit team matching** — match by name or ID, never inferred from overlapping GitHub handles, because people help on more than one team and a wrong auto-join on a public showcase is worse than an unlinked one.

**Showcase** — grid of submitted projects with search and track filter, public per-project pages with OG cards.

**Submission requirements** — organizer picks required fields from a small palette (URL link, short text, long text, file), each required or optional. Sprint's set is the shipped default so the feature works with zero configuration: *GitHub (URL, required) · Demo Video (URL, required) · Pitch Deck (URL, required) · Project Name (short text, required) · Description (long text, required).*

### 7.5 Judging

Sprint's judging tool ran a live event. Port the rules exactly:

- **Weighted criteria** — configurable per track; default is four criteria at equal weight
- **Blank ≠ zero** — a blank criterion means "did not see this team" and is **excluded from the average**, not counted as zero. The single most important rule here, and the one most platforms get wrong.
- **Local-first** — write every score to `localStorage` before sending, queue failures, retry. Sprint's rationale is exactly right: *a judging tool that stops working because the connection did is worse than one that never had a backend.* Non-negotiable.
- **Always exportable** — CSV/JSON at any point, regardless of backend state

New in v1:

- **Scoring input style** — slider (1–5) or three-level dropdown mapped onto the same scale. Switching styles leaves saved scores unchanged; unmappable values stay unselected until re-scored.
- **Judge assignment** with visible coverage
- **Real auth** — Sprint used a shared passcode because it was a public URL during a public event. Moonbase has accounts; judges get scoped invitations.

### 7.6 Data model additions

```
organizations        (from v0.3)
tracks               event_id, name, description, icon, sort_order
teams                event_id, track_id, slug, name, pitch, open, contact
team_members         team_id, user_id, role (captain|member), joined_at
team_join_requests   team_id, user_id, status
skills               tag vocabulary
team_skills          team_id, skill_id, kind (looking|have)
user_skills          user_id, skill_id
submissions          team_id, track_id, slug, title, tagline, description, status
submission_fields    scope_id, label, type, required, sort_order
submission_values    submission_id, field_id, value
submission_media     submission_id, kind (photo|video), url, sort_order
judges               event_id, user_id, track_scope
judging_criteria     track_id, name, description, weight
judge_assignments    judge_id, team_id
scores               judge_id, submission_id, criterion_id, value (nullable = not seen)
luma_links           event_id, luma_event_id, sync_state, last_synced_at
```

### 7.7 Exit criteria

Moonbase runs The Physical AI Sprint with no external tooling — public page, registration (native or Luma-backed), team formation, submissions, judging, winner. **One real event ships on it.**

---

## 8. v2 — Admissions and the door

**Goal:** get the right people in, and know who actually showed up.

The two moments organizers fall back to spreadsheets hardest.

### 8.1 Applications and admissions — *P0*

v0's registration is Luma-simple. Selective hackathons need admissions.

- **Application form builder** — typed questions with required flags, drag to reorder, live preview. Per-event, plus per-track forms.
- **Admission controls:**
  - Registration open (on/off)
  - Auto-approve while seats remain; pending once full
  - Whether applicants pick a track *before* acceptance, or the organizer places them on approval
- **Review inbox** — split-pane, with *Inbox · Approved · Waitlisted · Declined* counts, search, filters, shortlist stars, solo-vs-team filter, and **keyboard navigation** (↑↓ move, Space view, A assign). The keyboard path is what makes 300 applications survivable; build it in from the start, not later.
- **Bulk invite by CSV** — Email, First Name, Last Name required; LinkedIn and GitHub URLs optional. Async, with completion notification.
- **Terms & conditions** — optional PDF applicants accept before registering

**Simplicity guard:** the default event has no application form and no review queue. Admissions is a mode you turn on.

### 8.2 Check-ins and milestones — *P0*

The feature that most cleanly separates a hackathon platform from an event platform.

- **Check-in points** — named, typed, optionally track-scoped, with a date and start/end window, optionally multi-day. Type *Attendance*: each person checks in once per window; measures turnout.
- **Kiosk mode** — full-screen QR scanner at the door, always one tap from the console
- **Milestone forms** — a check-in point can require a form from each team, with its own fields. Critically: **"this milestone blocks final submission"** — teams cannot finalize until it is complete. This is how a multi-day event gets a real midpoint instead of everyone starting at hour 40.

### 8.3 The attendee sheet — *P0 · shipped early*

Organizers live in a spreadsheet. Every event runs a Google Sheet next to the platform, because a sheet is where you scan a list, sort it, filter it, and print it for the door. A platform that can't be a spreadsheet gets a spreadsheet built beside it — and then the spreadsheet becomes the source of truth.

So the attendee list *is* a spreadsheet:

- **A Sheets-grade grid** — A/B/C column letters, row numbers, frozen header, single-cell and range selection, arrow/tab/enter navigation, shift to extend, ⌘C to copy a selection as TSV straight into a real spreadsheet, click-to-sort columns, show/hide columns
- **Print** — the grid is a scrolling viewport with sticky headers and a selection model, none of which survives paper. Printing swaps in a plain repeating-header table plus a **"Checked in" column to tick with a pen**. That printed page is the actual door artifact.
- **Google Sheets connection without OAuth** — a tokenised read-only CSV feed that Sheets pulls itself:
  ```
  =IMPORTDATA("https://…/<slug>/attendees.csv?token=…")
  ```
  One formula, and the sheet stays live. No Google Cloud project, no OAuth consent screen, no write scope on the organizer's Drive. The token is the auth, so it is off by default, rotatable, and revocable — and the page says plainly that anyone the sheet is shared with can read the list.

Two implementation rules worth keeping:

1. **One column definition.** The on-screen grid, the CSV download and the Sheets feed all read the same builder. Three call sites composing their own columns is how a printed check-in sheet ends up disagreeing with the spreadsheet the door staff are holding.
2. **CSV injection is a real threat here.** A registrant named `=cmd|' /C calc'!A1` is a live formula the moment the export opens in Excel or Sheets. Every value leading with `= + - @` or a control character is prefixed with an apostrophe so it stays inert text.

*Later:* full OAuth (write back to a sheet the organizer picks, two-way status edits) is the v7 upgrade, once there's a reason to hold Drive scopes.

### 8.4 Event settings for real events — *P1*

- **Prize pool** — ordered prizes with placement, amount, description; surfaces on the public page
- **Onsite / Online / Hybrid** with address and embedded map
- **Tags** for discovery
- **Data export** — scoped per track: applications, registrations, teams, check-ins (one column per point), milestones, submissions. Show each export's columns before download.
- **Co-organizers & roles** — invite organizations as co-organizers and individuals by email with a role; event roles override org roles; pending invitations visible and revocable

### 8.5 Exit criteria

A 150-person, multi-track, multi-day event runs its admissions and its door on Moonbase, with no spreadsheet.

---

## 9. v3 — The messaging spine *(and goodbye Discord)*

**Goal:** the event lives in Moonbase for its whole duration, not in a Discord server the organizer has to build and moderate.

This version is where the "one product" claim gets real. Four things organizers currently run in four tools are one primitive here: **a message, addressed to a scope.**

### 9.1 Chat — *P0, the headline*

Displacing Discord is the single highest-leverage thing in this roadmap. Discord is where hackathons actually happen, and it costs the organizer a server setup, a role scheme, a bot, and a moderation burden — then fragments every piece of event data away from the platform.

- **Channels scoped to the event graph** — event-wide, per-track, per-team, plus organizer-only and judge-only. Membership is *derived from the data we already have*: joining a team joins its channel; accepting a track joins the track channel. **Zero role configuration.** This is the entire advantage over Discord, and it must stay true.
- **Team channels are private by default** and auto-archive when the event ends
- **Announcements channel** — read-only, fed by broadcast (§9.3)
- Threads, mentions, reactions, file and image sharing, link unfurls for submissions and teams
- Presence and typing indicators; read state per channel
- Search across the event
- **Moderation** — organizers can pin, delete, mute, and remove; a simple report path
- **Discord bridge, not a wall** — some communities will not move. A bridge that mirrors announcements into an existing Discord server (and optionally relays back) makes Moonbase adoptable without a migration fight. Ship the bridge alongside chat, not after.

**Non-goals:** voice, video, screen share, server-to-server federation, custom emoji economies. We are not building Discord. We are building the ~15% of Discord an event actually uses, wired to the event's data.

### 9.2 Help desk / mentors — *P0*

Once chat exists, the help desk is not a separate product — it is **a typed thread**.

- A builder opens a help request; it becomes a thread with a state machine: *waiting → in progress → escalated → resolved*
- **Mentors claim tickets; they are not assigned to teams.** Mentor capacity is fungible — assignment creates idle mentors and blocked teams.
- Mentors are invited by email and scoped to all tracks or specific ones
- Response-time and resolution stats fall out for free

### 9.3 Broadcast — *P1*

One-to-many messaging, composed once.

- **Channels:** in-app (always on), email, SMS, Discord (via the bridge)
- **Three steps:** Message → Audience → Review
- **Audience:** whole event / specific tracks / specific teams, crossed with roles (everyone / participants / judges / mentors), with a **live recipient count before send**
- **Variables:** recipient name and email, track name, event name and date, start time, organization, today's date
- **Two authoring modes:** plain text (same body everywhere) or a block-based designed email. Designed mode applies to email only; other channels get the plain-text version — the right split, and it keeps the simple path simple.
- **Sent history** with delivery and open tracking

### 9.4 Notification system — *P1*

Per-event control over every automated message, with template editing.

Catalog to implement:

- **Registration:** accepted · accepted across multiple tracks (**consolidated into one email**) · declined · waitlisted · track registration received · moved off waitlist
- **Submissions:** received · deadline reminder
- **Results:** first / second / third place · participation certificate & judge feedback · judge contribution certificate · mentor contribution certificate
- **Judging:** assignments issued
- **General:** event in one hour · sponsor benefit ready
- **Help:** submitted · new request · assigned · claimed · resolved · new comment
- **Roles & check-ins:** role accepted · check-in confirmed

Two details worth having from day one:

1. **KEY notifications** — high-stakes messages (winners, results) are marked and, with the toggle on, require explicit confirmation. Announcing the wrong winner to 150 people is unrecoverable.
2. **Consolidation** — accepting someone into three tracks sends one email, not three.

### 9.5 Exit criteria

An event runs with **no Discord server** — or with a bridged one the organizer didn't have to configure.

---

## 10. v4 — Judging at depth *(AI round)*

**Goal:** every team gets real feedback, and human judges spend their limited attention on the submissions that matter.

Per decision 5, the AI round is the requirement; multi-round is the container it needs.

### 10.1 Multi-round judging — *P0*

- **Rounds** on an event or track, each with a type (`ai` or `human`), a rubric, a judge pool, and a window
- **Advancement rules** — top N or top percentage per track advances to the next round
- Scores are scoped to a round; a team's history across rounds is visible
- Typical shape: **AI screening round → human finals**

### 10.2 The AI judging round — *P0, the headline*

An AI round scores every submission against the event's rubric and produces a ranked shortlist plus per-criterion rationale.

**Inputs:** submission fields, linked repo, demo video (transcript), pitch deck, and the team's milestone submissions.

**Design rules — these are what make it trustworthy:**

- **AI scores are always labeled and never silently blended** with human scores. They live in their own round with their own provenance.
- **The AI abstains, it does not guess.** No demo video means no score on criteria that require one — the same *blank ≠ zero* discipline as human judging (§7.5). An AI that scores an artifact it could not see is worse than no AI round.
- **Rationale is mandatory.** Every score carries its reasoning, quoting the artifact. A number without a reason is not reviewable, and reviewability is the whole point.
- **Humans can override anything**, and an override is recorded as such.
- **The AI round never solely determines a winner.** It produces a shortlist and draft feedback. A human round decides placements.

**The feature this unlocks:** participation certificates are supposed to carry judge feedback for *every* team (§10.3). No human panel can write 40 pieces of substantive feedback in the two hours after a demo day. An AI round can draft all of them, for a human to skim and release. That is a genuinely new capability, not a cost saving — and it is the most defensible thing in this document.

Implementation note: build on the latest Claude models (Opus 5 for scoring and rationale, Sonnet 5 where throughput matters). Prompt and rubric versioning must be stored with the scores so a result is reproducible after the fact.

### 10.3 Results and certificates — *P1*

- Computed leaderboard per track and per round, exportable
- **Certificates** — participation (with judge feedback attached), plus judge and mentor contribution certificates, delivered as email attachments off the notification templates
- Explicit gate: results calculated before certificates send; an unambiguous "not sent yet" state

### 10.4 Judging operations — *P1*

- **Outcomes dashboard** — completion %, judges, evaluations, average per judge, ready / in progress / pending
- **Per-track coverage** with drill-in to assignments and score review
- **Auto-assign** — distribute teams across judges respecting track scope and balancing load. The manual path does not survive 30 teams × 5 judges.
- **Coverage warnings** — teams with no judges flagged loudly

### 10.5 Console overview — *P1*

The console home, built on one good idea rather than a metric wall:

- **"Needs attention"** — a triage list of *actionable* states with a link to the fix, not vanity metrics. Real examples: accepted participants who haven't checked in anywhere; accepted participants not yet on a team; teams with no judges; submissions still in draft near deadline.
- Status grouped by object — tickets, submissions, teams — each figure carrying its qualifier ("2 without a team", "0 in draft")
- Countdown to event end; published/draft state
- A **setup guide with progress** for first-time organizers — the direct answer to the setup problem in §1

---

## 11. v5 — Mobile

**Goal:** the event is on phones. Meet it there.

Everything before this is mobile-web-responsive. v5 is where native earns its place — for the three things a browser does badly at a venue.

### 11.1 Participant app — *P0*

- **Chat with push notifications.** This alone justifies the app: it is the reason people keep Discord open on their phone during a hackathon, and web push is not good enough to displace it.
- Event schedule, announcements, and my team
- **Check-in** — wallet-style QR, offline-capable
- Team discovery and join requests
- Submission status and deadline reminders

### 11.2 Judge app — *P0*

Scoring on a phone, at a noisy venue, on conference wifi, is the actual use case — Sprint's local-first design already assumes it.

- Assigned submissions, rubric scoring, notes
- **Fully offline**, syncing when it can — the native version of the v1 guarantee
- Round-aware: shows AI-round context where it helps and marks it clearly as AI

### 11.3 Organizer companion — *P1*

Deliberately not the whole console. Door mode, live stats, broadcast send, and the "needs attention" list. Full configuration stays on desktop.

### 11.4 Platform notes

- React Native or Expo, sharing the web design tokens
- The kiosk scanner (§8.2) should be reachable from the organizer app — a phone becomes a door station with no extra hardware

---

## 12. v6 — The event index

**Goal:** know every hackathon happening, who runs it, and who sponsors it.

Per decision 4, this serves two masters and is worth building for either.

### 12.1 Indexing — *P0*

- Ingest public events from Luma, Devpost, Eventbrite, and community calendars
- Normalize into the event model; dedupe across sources
- Respect robots and terms; attribute and link to the source. This is an index, not a scrape-and-reprint.

### 12.2 Discovery and recommendations — *P0*

- Browse with real inventory from day one, rather than waiting for first-party supply
- Filters: open registration, format, source, country, city; sort by relevance
- Grid, list, and **map** views
- **Recommended events per user** — driven by skills, past attendance, location, and tracks. This is the retention loop for builders between events, and the reason a builder keeps an account.

### 12.3 Organizer and sponsor intelligence — *P0, this is GTM*

The index is our sales engine, and this is the part with real commercial value:

- Identify **organizers** running events in our space — the direct pipeline for Moonbase itself
- Identify **sponsors**, what they sponsor, how often, and at what scale — which is exactly what organizers desperately want and cannot get
- Surface trends: which categories are growing, which cities, which sponsors are increasing spend

This flows straight into v7's sponsor marketplace: we will already know who sponsors what before we ask anyone to list.

**Care required:** an index of organizations is fine; a dossier on individuals is not. Keep this at the org and event level, use public sources only, and honor removal requests.

---

## 13. v7 — The business

**Goal:** revenue, and the surfaces that justify it.

### 13.1 Sponsors — *P0*

- **Sponsor records** — name, logo, website, tier — feeding the public page
- **Sponsor dashboard** — impressions, attributable registrations, lead capture, code redemption
- **Sponsor codes** — upload a CSV of promo or credit codes, configure delivery to participants, with a "benefit ready" notification
- **Marketplace** — sponsors ↔ events matchmaking, seeded by the v6 index

### 13.2 Page builder — *P1, with a caveat*

A visual builder for the public event page: multi-page (home plus per-track), draggable blocks with visibility toggles, per-block inspector, page-level theme tokens, desktop/mobile preview, undo-redo, version history.

**The caveat matters.** A page builder is exactly the kind of feature that made BuilderBase too complicated to set up. It ships only if it is *additive to a page that is already beautiful by default* — an organizer must never be required to open it. If the builder becomes a step in creating an event, we have become the thing we are trying to beat.

### 13.3 Reports and analytics — *P2*

- **Data reports** — build, publish, and share a link with stakeholders; sponsors and partners want a URL, not a CSV
- **Analytics** — the funnel from page view → registration → acceptance → check-in → team → submission. The most valuable chart in the product is the drop-off between *accepted* and *checked in*, because that is the number organizers are actually judged on.

### 13.4 Org layer and billing — *P0*

- Organizations with members, roles, and admin
- Plan tiers; usage limits mapped to real cost — participants, events, SMS, email volume, AI judging runs

---

## 14. Roadmap summary

| | Theme | Core scope | Success test |
|---|---|---|---|
| **v0** | Front door | Luma clone hardened; orgs, Postgres path, email infra | A stranger mistakes it for Luma |
| **v1** | Teams, projects, judging, **Luma sync** | Tracks, teams, submissions, showcase, judging, Luma-backed events | The Physical AI Sprint runs entirely on it |
| **v2** | Admissions and the door | Application forms, review inbox, check-ins, milestones, kiosk, **attendee sheet + Sheets sync** | A 150-person multi-track event runs with zero spreadsheets |
| **v3** | **Messaging spine** | Chat + channels, help desk, broadcast, notifications, Discord bridge | An event runs with no Discord server |
| **v4** | **AI judging** | Multi-round, AI screening round, results, certificates, console triage | Every team gets substantive feedback within hours |
| **v5** | Mobile | Participant app, judge app, organizer companion | Judges score entirely on phones, offline |
| **v6** | Event index | Indexing, recommendations, organizer & sponsor intelligence | Inbound pipeline sourced from our own index |
| **v7** | Business | Sponsors, marketplace, page builder, reports, billing | Organizers we've never met sign up and pay |

**The constraint that outranks this table:** time to a published event stays under five minutes at every version. If a version cannot ship without breaking that, it ships smaller.

---

## 15. Non-goals

- **Feature parity with BuilderBase.** Explicitly rejected (§1, decision 1).
- **Ticketing and payments before v7.** Schema has price fields; leave them at zero. Paid hackathons are rare.
- **A general-purpose Discord.** No voice, video, screen share, or federation. We build the slice an event uses.
- **Project hosting or CI.** We link to GitHub; we do not run builds.
- **Being a general event platform.** Meetups and conferences are welcome on the v0 surface, but every prioritization call breaks toward the hackathon.
- **AI deciding winners.** The AI round shortlists and drafts feedback. Humans place.
- **Personal dossiers in the event index.** Org and event level only.

---

## 16. Open questions

1. **Chat retention and cost.** Chat is the most expensive thing here to run and the least differentiated to build. What is the retention policy, and does chat history survive the event? (Recommendation: archive read-only forever, since the showcase links into it.)
2. **Discord bridge depth.** Mirror announcements only, or full two-way relay? Two-way is meaningfully harder and may undercut the reason to move.
3. **AI judging cost model.** Per-submission inference against repos, transcripts, and decks is real money. Is it a plan feature, metered usage, or bundled with a headline number?
4. **Index legal posture.** Ingesting Luma and Devpost listings needs a clear position on terms and attribution before we build it, not after.
5. **Mobile timing.** v5 is late for something that mainly serves chat push. If chat lands well in v3, does a thin push-only app pull forward?
6. **Open-source boundary.** Decision 2 says "when ready" — but which parts? Core platform open with hosted AI judging and the index closed is the obvious split, and it should be chosen before the index is built.

---

## 17. Appendix — BuilderBase feature inventory

Reference map from the 52 screenshots. **This is a map of the problem space, not a backlog** (§1).

**URL shape:** `builderbase.com/organizations/{org}/events/{event}/{section}` · public event at `/event/{slug}` · discovery at `/events`

**Organizer console nav:** Page Builder · Data Reports · Overview · Event Settings · Tracks · Sponsors · Resources · Check-ins — *Participant Management:* Applications · Teams & Builders · Mentors & Support · Judges & Scoring · Broadcast — *Judging & Results:* Submissions · Results. Footer: plan badge, kiosk/display toggle, inbox.

**Event Settings sub-nav:** *Event:* General · Social sharing & SEO · Tracks — *Participants:* Application Form · Check-in Points — *Evaluation:* Submissions · Judging — *Advanced:* Notifications · Integrations · Data Export · Co-organizers & Roles

**Participant surface nav:** Overview · Discover Events · Profile — *(org switcher)* → My Events · Marketplace · Sponsor Dashboard · Members · Admin

**Integrations offered:** Discord (announcements and DMs via your server) · GitHub (connect an org for submissions and repos) · Luma (sync registrations and attendees)

**Patterns worth stealing:** keyboard-driven review inbox · "needs attention" triage over vanity metrics · per-track filter on nearly every view · KEY-marked destructive notifications requiring confirmation · live recipient count before broadcast send · setup guide with progress · block-based email builder that degrades to plain text on non-email channels · export cards that show their columns before download · scoring-style migration that leaves saved scores unchanged.

**Evidence for the simplicity thesis:** the console carries 17 top-level sections and 12 settings sub-pages before an organizer has published anything. The setup guide sits at 6/7 on a live, published event. That is the opening.
