import { Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CreateTeamForm } from "@/components/create-team-form";
import { EventSubnav } from "@/components/event-subnav";
import { Footer } from "@/components/footer";
import { SiteNav } from "@/components/site-nav";
import { AvatarStack } from "@/components/ui/avatar";
import { getCurrentUser } from "@/lib/auth";
import { getEventBySlug } from "@/lib/events";
import {
  getUserTeam,
  listTeamMembers,
  listTeams,
  listTracks,
  teamStats,
  type TeamFilter,
} from "@/lib/teams";
import { cn } from "@/lib/utils";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ filter?: string; q?: string; track?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  return { title: event ? `Teams · ${event.title}` : "Teams" };
}

const FILTERS: { key: TeamFilter; label: string }[] = [
  { key: "all", label: "All teams" },
  { key: "looking", label: "Looking for members" },
  { key: "closed", label: "Closed" },
  { key: "full", label: "Full" },
];

export default async function TeamsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const event = await getEventBySlug(slug);
  if (!event || !event.hackathonMode) notFound();

  const filter = (FILTERS.find((f) => f.key === sp.filter)?.key ??
    "all") as TeamFilter;

  const user = await getCurrentUser();
  const [rows, tracks, stats, myTeam] = await Promise.all([
    listTeams(event, { filter, q: sp.q, trackId: sp.track }),
    listTracks(event.id),
    teamStats(event),
    user ? getUserTeam(event.id, user.id) : Promise.resolve(null),
  ]);

  const members = await Promise.all(
    rows.map((r) => listTeamMembers(r.team.id)),
  );

  const href = (next: Partial<{ filter: string; q: string; track: string }>) => {
    const q = new URLSearchParams();
    const merged = { filter, q: sp.q, track: sp.track, ...next };
    if (merged.filter && merged.filter !== "all") q.set("filter", merged.filter);
    if (merged.q) q.set("q", merged.q);
    if (merged.track) q.set("track", merged.track);
    const s = q.toString();
    return `/${slug}/teams${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <SiteNav />
      <EventSubnav slug={slug} />

      <main className="mx-auto max-w-5xl px-6 pb-24 pt-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl">Teams</h1>
            <p className="mt-1 text-sm text-ink-secondary">
              {stats.teams} {stats.teams === 1 ? "team" : "teams"} ·{" "}
              {stats.open} with room · {stats.unattached} builders without a
              team
            </p>
          </div>
          {event.maxTeamSize != null && (
            <p className="text-sm text-ink-tertiary">
              Team size {event.minTeamSize ?? 1}–{event.maxTeamSize}
            </p>
          )}
        </header>

        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_300px]">
          {/* Directory */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {FILTERS.map((f) => (
                <Link
                  key={f.key}
                  href={href({ filter: f.key })}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[13px] transition-colors",
                    filter === f.key
                      ? "border-ink bg-ink text-white"
                      : "border-line-strong text-ink-secondary hover:text-ink",
                  )}
                >
                  {f.label}
                </Link>
              ))}
            </div>

            <form action={`/${slug}/teams`} className="mt-4">
              {filter !== "all" && (
                <input type="hidden" name="filter" value={filter} />
              )}
              <input
                name="q"
                defaultValue={sp.q ?? ""}
                placeholder="Search teams by name or pitch…"
                className="w-full rounded-[10px] border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-tertiary focus:border-ink/30 focus:outline-none"
              />
            </form>

            {rows.length === 0 ? (
              <p className="mt-6 rounded-2xl border border-dashed border-line px-6 py-12 text-center text-ink-secondary">
                No teams match. {filter !== "all" && "Try “All teams”."}
              </p>
            ) : (
              <ul className="mt-5 grid gap-3">
                {rows.map((row, i) => (
                  <li key={row.team.id}>
                    <Link
                      href={`/${slug}/teams/${row.team.slug}`}
                      className="flex items-start gap-4 rounded-2xl border border-line bg-surface p-4 transition-all hover:-translate-y-0.5 hover:shadow-card"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-medium text-ink">
                            {row.team.name}
                          </h3>
                          {row.full ? (
                            <Badge tone="muted">Full</Badge>
                          ) : row.team.open ? (
                            <Badge tone="green">Looking for members</Badge>
                          ) : (
                            <Badge tone="muted">Closed</Badge>
                          )}
                          {row.track && <Badge tone="blue">{row.track.name}</Badge>}
                        </div>
                        {row.team.pitch && (
                          <p className="mt-1 line-clamp-2 text-sm text-ink-secondary">
                            {row.team.pitch}
                          </p>
                        )}
                        <p className="mt-2 text-[13px] text-ink-tertiary">
                          {row.memberCount}{" "}
                          {row.memberCount === 1 ? "member" : "members"}
                          {event.maxTeamSize != null &&
                            ` of ${event.maxTeamSize}`}
                        </p>
                      </div>
                      <AvatarStack
                        names={members[i].map((m) => m.user.name)}
                        size={28}
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Sidebar */}
          <aside className="lg:pt-2">
            {myTeam ? (
              <div className="rounded-2xl border border-line bg-surface p-5">
                <p className="text-sm text-ink-secondary">You're on</p>
                <Link
                  href={`/${slug}/teams/${myTeam.team.slug}`}
                  className="mt-1 block text-lg text-ink hover:underline"
                >
                  {myTeam.team.name}
                </Link>
                <p className="mt-2 text-[13px] text-ink-tertiary">
                  {myTeam.role === "captain" ? "Captain" : "Member"}
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-line bg-surface p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Users size={16} className="text-ink-secondary" />
                  <h2 className="text-sm font-medium text-ink">
                    Start a team
                  </h2>
                </div>
                {user ? (
                  <CreateTeamForm eventSlug={slug} tracks={tracks} />
                ) : (
                  <p className="text-sm text-ink-secondary">
                    <Link
                      href={`/signin?next=${encodeURIComponent(`/${slug}/teams`)}`}
                      className="text-ink underline"
                    >
                      Sign in
                    </Link>{" "}
                    to create a team or ask to join one.
                  </p>
                )}
              </div>
            )}
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}

function Badge({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "green" | "blue";
}) {
  const tones = {
    muted: "bg-black/5 text-ink-secondary",
    green: "bg-green-500/10 text-green-700",
    blue: "bg-blue-500/10 text-blue-700",
  };
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-medium",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
