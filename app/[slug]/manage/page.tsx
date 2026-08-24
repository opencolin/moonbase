import { ArrowLeft, CalendarClock, CheckCircle2, Clock, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CopyButton } from "@/components/copy-button";
import { Footer } from "@/components/footer";
import { GuestList, type ManageGuest } from "@/components/guest-list";
import { SiteNav } from "@/components/site-nav";
import { ButtonLink } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { formatEventDay } from "@/lib/dates";
import { getEventForManage } from "@/lib/events";

export const metadata: Metadata = { title: "Manage Event" };

type Params = { params: Promise<{ slug: string }> };

export default async function ManagePage({ params }: Params) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/signin?next=/${slug}/manage`);

  const data = await getEventForManage(slug, user.id);
  if (!data) notFound();

  const { event, registrations } = data;

  const by = (s: string) => registrations.filter((r) => r.status === s).length;
  const going = by("going");
  const pending = by("pending");
  const waitlist = by("waitlist");

  const guests: ManageGuest[] = registrations.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    status: r.status,
    guestCount: r.guestCount,
    ticketName: r.ticketName,
    registeredLabel: formatEventDay(r.createdAt, event.timezone).replace(
      /^\w+, /,
      "",
    ),
  }));

  const stats = [
    { label: "Going", value: going, icon: CheckCircle2, tone: "text-green" },
    ...(event.requiresApproval || pending
      ? [{ label: "Pending", value: pending, icon: Clock, tone: "text-amber" }]
      : []),
    ...(waitlist
      ? [{ label: "Waitlist", value: waitlist, icon: Users, tone: "text-blue" }]
      : []),
    {
      label: "Capacity",
      value: event.capacity ?? "∞",
      icon: CalendarClock,
      tone: "text-ink-secondary",
    },
  ];

  return (
    <>
      <SiteNav />
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <Link
          href={`/${event.slug}`}
          className="inline-flex items-center gap-1.5 text-[13px] text-ink-secondary transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to event
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[13px] font-medium text-ink-tertiary">Manage</p>
            <h1 className="text-2xl tracking-tight sm:text-3xl">{event.title}</h1>
            <p className="mt-1 text-sm text-ink-secondary">
              {formatEventDay(event.startAt, event.timezone)}
            </p>
          </div>
          <div className="flex gap-2">
            <CopyButton path={`/${event.slug}`} />
            <ButtonLink
              href={`/${event.slug}/manage/sheet`}
              variant="secondary"
            >
              Attendee sheet
            </ButtonLink>
            <ButtonLink href={`/${event.slug}`} variant="secondary">
              View page
            </ButtonLink>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-line bg-surface p-4">
              <s.icon className={`h-4 w-4 ${s.tone}`} />
              <p className="mt-2 text-2xl font-medium tracking-tight text-ink">
                {s.value}
              </p>
              <p className="text-[13px] text-ink-tertiary">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Guests */}
        <div className="mt-8">
          <h2 className="mb-3 text-lg">
            Guests{" "}
            <span className="text-ink-tertiary">({registrations.length})</span>
          </h2>
          {registrations.length === 0 ? (
            <div className="rounded-2xl border border-line bg-surface p-12 text-center">
              <p className="text-ink-secondary">No registrations yet.</p>
              <p className="mt-1 text-[13px] text-ink-tertiary">
                Share your invite link to get your first guests.
              </p>
            </div>
          ) : (
            <GuestList guests={guests} requiresApproval={event.requiresApproval} />
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
