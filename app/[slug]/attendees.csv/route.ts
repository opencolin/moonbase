import { eq } from "drizzle-orm";
import { db } from "@/db";
import { events } from "@/db/schema";
import { buildAttendeeSheet, toCsv } from "@/lib/attendee-sheet";

/**
 * Read-only attendee feed for Google Sheets.
 *
 *   =IMPORTDATA("https://…/<slug>/attendees.csv?token=…")
 *
 * Sheets fetches this itself on a schedule, which buys a genuinely live
 * connection with no OAuth, no Google Cloud project, and no write scope on
 * the organizer's Drive. The tradeoff is that the token *is* the auth, so
 * it's rotatable and off by default.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const token = new URL(request.url).searchParams.get("token");

  const event = await db
    .select()
    .from(events)
    .where(eq(events.slug, slug))
    .get();

  // Same response whether the event is missing, the feed is off, or the
  // token is wrong — a 404 that distinguishes them is a token oracle.
  if (!event || !event.feedToken || !token || token !== event.feedToken) {
    return new Response("Not found", { status: 404 });
  }

  const sheet = await buildAttendeeSheet(event);

  return new Response(toCsv(sheet), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `inline; filename="${slug}-attendees.csv"`,
      // Sheets caches aggressively; this keeps the pull reasonably fresh.
      "Cache-Control": "no-store, max-age=0",
      "X-Robots-Tag": "noindex",
    },
  });
}
