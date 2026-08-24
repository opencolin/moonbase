import { CalendarDays, Globe, Lock, MapPin, Users } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/footer";
import { EventCover, THEME_STOPS } from "@/components/event-cover";
import { Markdown } from "@/components/markdown";
import { MapBlock } from "@/components/map-block";
import { RegistrationForm } from "@/components/registration-form";
import { EventSubnav } from "@/components/event-subnav";
import { SiteNav } from "@/components/site-nav";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { getEventBySlug, findRegistration } from "@/lib/events";
import { getCurrentUser } from "@/lib/auth";
import { dateTile, formatEventDay, formatEventTime, isPast } from "@/lib/dates";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) return { title: "Event not found" };
  return {
    title: event.title,
    description: event.description?.slice(0, 160) || undefined,
  };
}

export default async function EventPage({ params }: Params) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const [user, jar] = await Promise.all([getCurrentUser(), cookies()]);
  const guestEmail = jar.get("luma_guest_email")?.value;
  const checkEmail = user?.email ?? guestEmail;
  const existing = checkEmail
    ? await findRegistration(event.id, checkEmail)
    : null;

  const past = isPast(event.endAt, event.startAt);
  const isFull =
    event.capacity != null && event.goingCount >= event.capacity;
  const tile = dateTile(event.startAt, event.timezone);
  const stops = THEME_STOPS[event.themeColor] ?? THEME_STOPS.indigo;

  const showAddress = !event.hideAddress || !!existing;

  return (
    <>
      <SiteNav />

      {/* Teams / builders / showcase live behind this. Only hackathon
          events render it, so an ordinary meetup page is untouched. */}
      {event.hackathonMode && <EventSubnav slug={slug} />}

      {/* themed ambient backdrop */}
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.18]"
        style={{
          background: `radial-gradient(60% 50% at 20% 0%, ${stops[0]}, transparent), radial-gradient(50% 40% at 90% 10%, ${stops[2]}, transparent)`,
        }}
      />

      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 md:py-12">
        <div className="grid gap-8 md:grid-cols-[minmax(0,380px)_1fr] md:gap-10">
          {/* LEFT */}
          <aside className="space-y-5 md:sticky md:top-24 md:self-start">
            <EventCover
              coverUrl={event.coverUrl}
              theme={event.themeColor}
              pattern={event.coverPattern}
              title={event.title}
              showTitle={!event.coverUrl}
              className="aspect-square w-full shadow-card"
            />

            <HostCard
              host={event.host}
              cohosts={event.cohosts}
              calendar={event.calendar}
            />

            <div className="flex items-center gap-4 px-1 text-[13px] text-ink-tertiary">
              <Link href={`mailto:${event.host.email}`} className="hover:text-ink">
                Contact the Host
              </Link>
              <span>·</span>
              <Link href="#" className="hover:text-ink">
                Report Event
              </Link>
            </div>
          </aside>

          {/* RIGHT */}
          <div className="min-w-0 space-y-6">
            {event.calendar && (
              <Link
                href={`/c/${event.calendar.slug}`}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-[13px] text-ink-secondary transition-colors hover:text-ink"
              >
                <Avatar name={event.calendar.name} size={18} />
                {event.calendar.name}
              </Link>
            )}

            <h1 className="text-[32px] leading-[1.1] tracking-[-0.025em] sm:text-[40px]">
              {event.title}
            </h1>

            {/* meta */}
            <div className="space-y-3">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 flex-col items-center justify-center overflow-hidden rounded-lg border border-line bg-surface">
                  <span className="w-full bg-surface-2 text-center text-[9px] font-semibold uppercase tracking-wider text-ink-secondary">
                    {tile.month}
                  </span>
                  <span className="flex-1 content-center text-lg font-medium leading-none text-ink">
                    {tile.day}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-ink">
                    {formatEventDay(event.startAt, event.timezone)}
                  </p>
                  <p className="text-sm text-ink-secondary">
                    {formatEventTime(event.startAt, event.endAt, event.timezone)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-line bg-surface text-ink-secondary">
                  {event.locationType === "online" ? (
                    <Globe className="h-5 w-5" />
                  ) : (
                    <MapPin className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0">
                  {event.locationType === "online" ? (
                    <p className="font-medium text-ink">Online Event</p>
                  ) : showAddress ? (
                    <>
                      <p className="font-medium text-ink">
                        {event.locationName ?? "Location"}
                      </p>
                      {event.locationAddress && (
                        <p className="truncate text-sm text-ink-secondary">
                          {event.locationAddress}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-ink">Register to See Address</p>
                      <p className="text-sm text-ink-secondary">
                        {event.locationName ?? "San Francisco, CA"}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Registration card */}
            <div className="card overflow-hidden">
              <div className="border-b border-line bg-surface-2/60 px-5 py-3 text-[13px] font-medium text-ink-secondary">
                {past
                  ? "This event has ended"
                  : event.requiresApproval
                    ? "Welcome! To join the event, request approval below."
                    : "Registration"}
              </div>
              <div className="p-5">
                {!past && (
                  <p className="mb-4 text-sm text-ink-secondary">
                    Welcome! Please register below to attend.
                  </p>
                )}
                <RegistrationForm
                  eventId={event.id}
                  tickets={event.tickets}
                  requiresApproval={event.requiresApproval}
                  isFull={isFull}
                  isPast={past}
                  initialStatus={
                    (existing?.status as "going" | "pending" | "waitlist") ??
                    null
                  }
                  prefill={
                    user ? { name: user.name, email: user.email } : undefined
                  }
                />
              </div>
            </div>

            {/* Going */}
            {event.goingCount > 0 && (
              <div className="flex items-center gap-3">
                <Users className="h-4 w-4 text-ink-tertiary" />
                {event.attendeeNames.length > 0 && (
                  <AvatarStack names={event.attendeeNames} size={26} />
                )}
                <span className="text-sm text-ink-secondary">
                  {event.goingCount} {event.goingCount === 1 ? "person is" : "people are"} going
                </span>
              </div>
            )}

            {/* About */}
            {event.description && (
              <section>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-tertiary">
                  About Event
                </h2>
                <Markdown>{event.description}</Markdown>
              </section>
            )}

            {/* Location */}
            {event.locationType !== "online" && (
              <section>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-tertiary">
                  Location
                </h2>
                {showAddress ? (
                  <MapBlock
                    name={event.locationName}
                    address={event.locationAddress}
                  />
                ) : (
                  <div className="flex items-center gap-2 rounded-xl border border-line bg-surface p-4 text-sm text-ink-secondary">
                    <Lock className="h-4 w-4" />
                    Register to see the exact location of this event.
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}

function HostCard({
  host,
  cohosts,
  calendar,
}: {
  host: { name: string; avatarUrl: string | null };
  cohosts: { id: string; name: string; avatarUrl: string | null }[];
  calendar: { name: string } | null;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface/60 p-4">
      <p className="mb-3 text-[13px] font-medium text-ink-tertiary">
        Hosted By
      </p>
      <div className="space-y-3">
        <div className="flex items-center gap-2.5">
          <Avatar name={host.name} src={host.avatarUrl} size={28} />
          <span className="text-sm font-medium text-ink">{host.name}</span>
        </div>
        {cohosts.map((c) => (
          <div key={c.id} className="flex items-center gap-2.5">
            <Avatar name={c.name} src={c.avatarUrl} size={28} />
            <span className="text-sm text-ink">{c.name}</span>
          </div>
        ))}
        {calendar && (
          <p className="pt-1 text-[13px] text-ink-tertiary">
            Presented by {calendar.name}
          </p>
        )}
      </div>
    </div>
  );
}
