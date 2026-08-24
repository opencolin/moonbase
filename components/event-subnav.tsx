"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Sub-navigation for hackathon events only. A plain meetup never renders
 * this, which is how tracks/teams/submissions stay invisible until an
 * organizer opts in.
 */
export function EventSubnav({
  slug,
  showShowcase = true,
}: {
  slug: string;
  showShowcase?: boolean;
}) {
  const pathname = usePathname();

  const items = [
    { href: `/${slug}`, label: "Event", exact: true },
    { href: `/${slug}/teams`, label: "Teams" },
    { href: `/${slug}/builders`, label: "Builders" },
    ...(showShowcase
      ? [{ href: `/${slug}/showcase`, label: "Showcase" }]
      : []),
  ];

  return (
    <nav className="border-b border-line">
      <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-6">
        {items.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative whitespace-nowrap px-3 py-3 text-sm transition-colors",
                active
                  ? "text-ink after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-ink"
                  : "text-ink-secondary hover:text-ink",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
