import { Check, Plus } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { toggleSubscribe } from "@/app/actions/calendars";
import { EventCard } from "@/components/event-card";
import { Footer } from "@/components/footer";
import { SiteNav } from "@/components/site-nav";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { getCalendarBySlug, isSubscribed } from "@/lib/calendars";
import { listEvents } from "@/lib/events";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const calendar = await getCalendarBySlug(slug);
  if (!calendar) return { title: "Calendar not found" };
  return {
    title: calendar.name,
    description: calendar.description ?? `Events from ${calendar.name}.`,
  };
}

export default async function CalendarPage({ params }: Props) {
  const { slug } = await params;
  const calendar = await getCalendarBySlug(slug);
  if (!calendar) notFound();

  const user = await getCurrentUser();
  const [upcoming, past, subscribed] = await Promise.all([
    listEvents({ when: "upcoming", calendarId: calendar.id }),
    listEvents({ when: "past", calendarId: calendar.id, limit: 12 }),
    user ? isSubscribed(calendar.id, user.id) : Promise.resolve(false),
  ]);

  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-5xl px-6 pb-24 pt-10">
        {/* Header */}
        <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <Avatar name={calendar.name} src={calendar.avatarUrl} size={64} />
            <div>
              <h1 className="text-3xl">{calendar.name}</h1>
              {calendar.description && (
                <p className="mt-2 max-w-xl text-ink-secondary">
                  {calendar.description}
                </p>
              )}
              <p className="mt-3 text-sm text-ink-tertiary">
                {calendar.subscriberCount}{" "}
                {calendar.subscriberCount === 1 ? "subscriber" : "subscribers"}
                {" · "}
                {calendar.upcomingCount} upcoming
              </p>
            </div>
          </div>

          <form action={toggleSubscribe}>
            <input type="hidden" name="slug" value={calendar.slug} />
            <Button
              type="submit"
              variant={subscribed ? "secondary" : "primary"}
              size="md"
            >
              {subscribed ? (
                <>
                  <Check size={16} /> Subscribed
                </>
              ) : (
                <>
                  <Plus size={16} /> Subscribe
                </>
              )}
            </Button>
          </form>
        </header>

        {/* Upcoming */}
        <section className="mt-12">
          <h2 className="text-xl">Upcoming</h2>
          {upcoming.length ? (
            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((row) => (
                <EventCard key={row.event.id} row={row} />
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-2xl border border-dashed border-line px-6 py-10 text-center text-ink-secondary">
              No upcoming events yet. Subscribe to hear about the next one.
            </p>
          )}
        </section>

        {/* Past */}
        {past.length > 0 && (
          <section className="mt-14">
            <h2 className="text-xl">Past</h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {past.map((row) => (
                <EventCard key={row.event.id} row={row} />
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
