import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  leaveTeam,
  requestToJoin,
  resolveJoinRequest,
  setTeamOpen,
} from "@/app/actions/teams";
import { EventSubnav } from "@/components/event-subnav";
import { Footer } from "@/components/footer";
import { SiteNav } from "@/components/site-nav";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { getEventBySlug } from "@/lib/events";
import {
  getPendingRequest,
  getTeamBySlug,
  getUserTeam,
  listJoinRequests,
} from "@/lib/teams";

type Props = { params: Promise<{ slug: string; teamSlug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, teamSlug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) return { title: "Team" };
  const team = await getTeamBySlug(event.id, teamSlug);
  return { title: team ? `${team.team.name} · ${event.title}` : "Team" };
}

export default async function TeamPage({ params }: Props) {
  const { slug, teamSlug } = await params;
  const event = await getEventBySlug(slug);
  if (!event || !event.hackathonMode) notFound();

  const team = await getTeamBySlug(event.id, teamSlug);
  if (!team) notFound();

  const user = await getCurrentUser();
  const myTeam = user ? await getUserTeam(event.id, user.id) : null;

  const isMember = team.members.some((m) => m.user.id === user?.id);
  const isCaptain = team.members.some(
    (m) => m.user.id === user?.id && m.role === "captain",
  );
  const canManage = isCaptain || event.hostId === user?.id;

  const requests = canManage ? await listJoinRequests(team.team.id) : [];
  const myRequest =
    user && !isMember
      ? await getPendingRequest(team.team.id, user.id)
      : null;
  const full =
    event.maxTeamSize != null && team.members.length >= event.maxTeamSize;

  return (
    <>
      <SiteNav />
      <EventSubnav slug={slug} />

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-8">
        <Link
          href={`/${slug}/teams`}
          className="inline-flex items-center gap-1.5 text-sm text-ink-secondary hover:text-ink"
        >
          <ArrowLeft size={14} /> All teams
        </Link>

        <header className="mt-5">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl">{team.team.name}</h1>
            {team.track && (
              <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-700">
                {team.track.name}
              </span>
            )}
          </div>
          {team.team.pitch && (
            <p className="mt-3 text-ink-secondary">{team.team.pitch}</p>
          )}
          <p className="mt-3 text-sm text-ink-tertiary">
            {team.members.length}{" "}
            {team.members.length === 1 ? "member" : "members"}
            {event.maxTeamSize != null && ` of ${event.maxTeamSize}`}
            {" · "}
            {full ? "Full" : team.team.open ? "Looking for members" : "Closed"}
          </p>
        </header>

        {/* Roster */}
        <section className="mt-9">
          <h2 className="text-sm font-medium uppercase tracking-wide text-ink-tertiary">
            Roster
          </h2>
          <ul className="mt-3 grid gap-2">
            {team.members.map((m) => (
              <li
                key={m.user.id}
                className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3"
              >
                <Avatar name={m.user.name} src={m.user.avatarUrl} size={34} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{m.user.name}</p>
                  {m.role === "captain" && (
                    <p className="text-[12px] text-ink-tertiary">Captain</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Pending requests — captain only */}
        {canManage && requests.length > 0 && (
          <section className="mt-9">
            <h2 className="text-sm font-medium uppercase tracking-wide text-ink-tertiary">
              Requests to join · {requests.length}
            </h2>
            <ul className="mt-3 grid gap-2">
              {requests.map(({ request, user: requester }) => (
                <li
                  key={request.id}
                  className="rounded-xl border border-line bg-surface px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={requester.name} size={34} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">
                        {requester.name}
                      </p>
                      {request.message && (
                        <p className="mt-0.5 text-[13px] text-ink-secondary">
                          {request.message}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <form action={resolveJoinRequest}>
                        <input
                          type="hidden"
                          name="requestId"
                          value={request.id}
                        />
                        <input type="hidden" name="decision" value="declined" />
                        <Button type="submit" variant="secondary" size="sm">
                          Decline
                        </Button>
                      </form>
                      <form action={resolveJoinRequest}>
                        <input
                          type="hidden"
                          name="requestId"
                          value={request.id}
                        />
                        <input type="hidden" name="decision" value="accepted" />
                        <Button type="submit" size="sm" disabled={full}>
                          {full ? "Team full" : "Accept"}
                        </Button>
                      </form>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Actions */}
        <section className="mt-10 flex flex-wrap gap-3">
          {myRequest && (
            <p className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink-secondary">
              Your request to join is pending. The captain will get back to
              you.
            </p>
          )}

          {!isMember && !myTeam && !myRequest && team.team.open && !full && (
            <form action={requestToJoin} className="flex w-full gap-2">
              <input type="hidden" name="eventSlug" value={slug} />
              <input type="hidden" name="teamSlug" value={teamSlug} />
              <input
                name="message"
                placeholder="Say hello — what would you work on?"
                maxLength={500}
                className="flex-1 rounded-[10px] border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-tertiary focus:border-ink/30 focus:outline-none"
              />
              <Button type="submit">Ask to join</Button>
            </form>
          )}

          {!isMember && myTeam && (
            <p className="text-sm text-ink-secondary">
              You're already on{" "}
              <Link
                href={`/${slug}/teams/${myTeam.team.slug}`}
                className="text-ink underline"
              >
                {myTeam.team.name}
              </Link>
              .
            </p>
          )}

          {!isMember && !myTeam && !myRequest && (!team.team.open || full) && (
            <p className="text-sm text-ink-secondary">
              This team isn't taking new members right now.
            </p>
          )}

          {canManage && (
            <form action={setTeamOpen}>
              <input type="hidden" name="eventSlug" value={slug} />
              <input type="hidden" name="teamSlug" value={teamSlug} />
              <input
                type="hidden"
                name="open"
                value={team.team.open ? "false" : "true"}
              />
              <Button type="submit" variant="secondary">
                {team.team.open ? "Close to new members" : "Open to members"}
              </Button>
            </form>
          )}

          {isMember && (
            <form action={leaveTeam}>
              <input type="hidden" name="eventSlug" value={slug} />
              <input type="hidden" name="teamSlug" value={teamSlug} />
              <Button type="submit" variant="ghost">
                Leave team
              </Button>
            </form>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
