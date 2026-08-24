import { ArrowLeft, Download, Table2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { disableFeed, rotateFeedToken } from "@/app/actions/sheet";
import { CopyButton } from "@/components/copy-button";
import { Footer } from "@/components/footer";
import { SheetToolbar } from "@/components/sheet-toolbar";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { buildAttendeeSheet } from "@/lib/attendee-sheet";
import { getCurrentUser } from "@/lib/auth";
import { formatEventDay, formatEventTime } from "@/lib/dates";
import { absoluteUrl } from "@/lib/email";
import { getEventForManage } from "@/lib/events";

type Props = { params: Promise<{ slug: string }> };

export const metadata: Metadata = { title: "Attendee sheet" };

export default async function SheetPage({ params }: Props) {
  const { slug } = await params;

  const user = await getCurrentUser();
  if (!user) redirect(`/signin?next=${encodeURIComponent(`/${slug}/manage/sheet`)}`);

  const data = await getEventForManage(slug, user.id);
  if (!data) notFound();

  const { event } = data;
  const sheet = await buildAttendeeSheet(event);
  const when = `${formatEventDay(event.startAt, event.timezone)}, ${formatEventTime(event.startAt, event.endAt, event.timezone)}`;

  const feedUrl = event.feedToken
    ? absoluteUrl(`/${slug}/attendees.csv?token=${event.feedToken}`)
    : null;

  return (
    <>
      <div className="no-print">
        <SiteNav />
      </div>

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-8">
        <div className="no-print">
          <Link
            href={`/${slug}/manage`}
            className="inline-flex items-center gap-1.5 text-sm text-ink-secondary hover:text-ink"
          >
            <ArrowLeft size={14} /> Back to manage
          </Link>

          <header className="mt-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Table2 size={20} className="text-ink-secondary" />
                <h1 className="text-2xl">Attendee sheet</h1>
              </div>
              <p className="mt-1 text-sm text-ink-secondary">
                {event.title} · {when}
              </p>
            </div>

            <a
              href={`/${slug}/attendees.csv?token=${event.feedToken ?? ""}`}
              download={`${slug}-attendees.csv`}
              className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-line-strong bg-surface px-4 text-sm font-medium text-ink hover:bg-surface-2"
              aria-disabled={!event.feedToken}
            >
              <Download size={15} />
              Download CSV
            </a>
          </header>
        </div>

        <SheetToolbar
          columns={sheet.columns}
          rows={sheet.rows}
          eventTitle={event.title}
          eventWhen={when}
        />

        {/* Google Sheets connection */}
        <section className="no-print mt-10 rounded-2xl border border-line bg-surface p-6">
          <h2 className="text-lg">Connect to Google Sheets</h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-secondary">
            Paste one formula into a Google Sheet and it stays in sync — Google
            re-fetches on its own, so approvals and new registrations appear
            without another export.
          </p>

          {feedUrl ? (
            <>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-lg border border-line bg-surface-2 px-3 py-2 font-mono text-[12px] text-ink">
                  {`=IMPORTDATA("${feedUrl}")`}
                </code>
                <CopyButton value={`=IMPORTDATA("${feedUrl}")`} />
              </div>

              <p className="mt-3 text-[13px] text-ink-tertiary">
                Anyone with this link can read your attendee list, including
                everyone you share the sheet with. Rotate it if that changes.
              </p>

              <div className="mt-4 flex gap-2">
                <form action={rotateFeedToken}>
                  <input type="hidden" name="slug" value={slug} />
                  <Button type="submit" variant="secondary" size="sm">
                    Rotate link
                  </Button>
                </form>
                <form action={disableFeed}>
                  <input type="hidden" name="slug" value={slug} />
                  <Button type="submit" variant="ghost" size="sm">
                    Disable
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <form action={rotateFeedToken} className="mt-4">
              <input type="hidden" name="slug" value={slug} />
              <Button type="submit">Create sync link</Button>
            </form>
          )}
        </section>
      </main>

      <div className="no-print">
        <Footer />
      </div>
    </>
  );
}
