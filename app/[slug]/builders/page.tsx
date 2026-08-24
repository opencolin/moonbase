import { Code2, Globe } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { setLookingForTeam } from "@/app/actions/teams";
import { EventSubnav } from "@/components/event-subnav";
import { Footer } from "@/components/footer";
import { SiteNav } from "@/components/site-nav";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { getEventBySlug } from "@/lib/events";
import {
  listBuilders,
  teamStats,
  type BuilderFilter,
} from "@/lib/teams";
import { cn } from "@/lib/utils";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ filter?: string; q?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  return { title: event ? `Builders · ${event.title}` : "Builders" };
}

const FILTERS: { key: BuilderFilter; label: string }[] = [
  { key: "all", label: "All builders" },
  { key: "looking", label: "Looking for team" },
  { key: "in_team", label: "In a team" },
];

export default async function BuildersPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const event = await getEventBySlug(slug);
  if (!event || !event.hackathonMode) notFound();

  const filter = (FILTERS.find((f) => f.key === sp.filter)?.key ??
    "all") as BuilderFilter;

  const user = await getCurrentUser();
  const [rows, stats] = await Promise.all([
    listBuilders(event.id, { filter, q: sp.q }),
    teamStats(event),
  ]);

  const me = user ? rows.find((r) => r.user.id === user.id) : null;

  const href = (nextFilter: BuilderFilter) => {
    const q = new URLSearchParams();
    if (nextFilter !== "all") q.set("filter", nextFilter);
    if (sp.q) q.set("q", sp.q);
    const s = q.toString();
    return `/${slug}/builders${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <SiteNav />
      <EventSubnav slug={slug} />

      <main className="mx-auto max-w-5xl px-6 pb-24 pt-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl">Builders</h1>
            <p className="mt-1 text-sm text-ink-secondary">
              {stats.builders} participating · {stats.unattached} without a
              team
            </p>
          </div>

          {/* Opt in/out of the "looking for team" list */}
          {user && me && !me.team && (
            <form action={setLookingForTeam}>
              <input type="hidden" name="eventSlug" value={slug} />
              <input
                type="hidden"
                name="looking"
                value={me.participant.lookingForTeam ? "false" : "true"}
              />
              <Button
                type="submit"
                variant={me.participant.lookingForTeam ? "secondary" : "primary"}
                size="sm"
              >
                {me.participant.lookingForTeam
                  ? "Stop looking for a team"
                  : "I'm looking for a team"}
              </Button>
            </form>
          )}
        </header>

        <div className="mt-7 flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={href(f.key)}
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

        <form action={`/${slug}/builders`} className="mt-4">
          {filter !== "all" && (
            <input type="hidden" name="filter" value={filter} />
          )}
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Search builders by name or email…"
            className="w-full rounded-[10px] border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-tertiary focus:border-ink/30 focus:outline-none"
          />
        </form>

        {rows.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-line px-6 py-12 text-center text-ink-secondary">
            No builders here yet. People appear once they join the event.
          </p>
        ) : (
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {rows.map((row) => (
              <li
                key={row.user.id}
                className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4"
              >
                <Avatar
                  name={row.user.name}
                  src={row.user.avatarUrl}
                  size={40}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {row.user.name}
                  </p>
                  {row.team ? (
                    <Link
                      href={`/${slug}/teams/${row.team.slug}`}
                      className="text-[13px] text-ink-secondary hover:text-ink hover:underline"
                    >
                      {row.team.name}
                    </Link>
                  ) : row.participant.lookingForTeam ? (
                    <p className="text-[13px] text-green-700">
                      Looking for a team
                    </p>
                  ) : (
                    <p className="text-[13px] text-ink-tertiary">Solo</p>
                  )}

                  {(row.participant.githubUrl || row.participant.websiteUrl) && (
                    <div className="mt-2 flex gap-3">
                      {row.participant.githubUrl && (
                        <a
                          href={row.participant.githubUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-ink-tertiary hover:text-ink"
                          aria-label={`${row.user.name} on GitHub`}
                        >
                          <Code2 size={15} />
                        </a>
                      )}
                      {row.participant.websiteUrl && (
                        <a
                          href={row.participant.websiteUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-ink-tertiary hover:text-ink"
                          aria-label={`${row.user.name}'s website`}
                        >
                          <Globe size={15} />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
      <Footer />
    </>
  );
}
