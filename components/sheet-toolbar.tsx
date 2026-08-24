"use client";

import { Printer, Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { SheetGrid } from "@/components/sheet-grid";
import { Button } from "@/components/ui/button";
import type { SheetColumn } from "@/lib/attendee-sheet";
import { cn } from "@/lib/utils";

/**
 * Toolbar + grid. Search and column visibility are client state rather than
 * URL state on purpose: an organizer filtering the sheet at the door is
 * doing something momentary, and a URL that survives a refresh would hide
 * attendees without explaining why.
 */
export function SheetToolbar({
  columns,
  rows,
  eventTitle,
  eventWhen,
}: {
  columns: SheetColumn[];
  rows: Record<string, string>[];
  eventTitle: string;
  eventWhen: string;
}) {
  const [q, setQ] = useState("");
  const [hidden, setHidden] = useState<string[]>([]);
  const [showCols, setShowCols] = useState(false);

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const needle = q.toLowerCase();
    return rows.filter((row) =>
      columns.some((c) => (row[c.key] ?? "").toLowerCase().includes(needle)),
    );
  }, [q, rows, columns]);

  const toggle = (key: string) =>
    setHidden((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );

  return (
    <>
      <div className="sheet-toolbar mt-6 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search attendees…"
            aria-label="Search attendees"
            className="w-full rounded-[10px] border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-tertiary focus:border-ink/30 focus:outline-none"
          />
        </div>

        <div className="relative">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => setShowCols((v) => !v)}
            aria-expanded={showCols}
          >
            <SlidersHorizontal size={15} />
            Columns
            {hidden.length > 0 && (
              <span className="text-ink-tertiary">· {hidden.length} hidden</span>
            )}
          </Button>

          {showCols && (
            <div className="absolute right-0 z-40 mt-1 w-56 rounded-xl border border-line bg-surface p-2 shadow-card">
              {columns.map((c) => (
                <label
                  key={c.key}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink hover:bg-black/5"
                >
                  <input
                    type="checkbox"
                    checked={!hidden.includes(c.key)}
                    onChange={() => toggle(c.key)}
                    className="accent-ink"
                  />
                  {c.label}
                </label>
              ))}
            </div>
          )}
        </div>

        <Button type="button" variant="secondary" onClick={() => window.print()}>
          <Printer size={15} />
          Print
        </Button>
      </div>

      {/* Print-only header. The screen already shows this in the page chrome. */}
      <div className="print-header hidden">
        <h1>{eventTitle}</h1>
        <p>
          {eventWhen} · {filtered.length} attendees
        </p>
      </div>

      <div className="mt-3">
        <SheetGrid
          columns={columns}
          rows={filtered}
          hiddenKeys={hidden}
          emptyLabel={
            q ? "No attendees match that search." : "No attendees yet."
          }
        />
      </div>

      {/* Printed check-in sheet: same rows, plus a column to sign. */}
      <table className={cn("print-table hidden")}>
        <thead>
          <tr>
            {columns
              .filter((c) => !hidden.includes(c.key))
              .map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
            <th className="signature-col">Checked in</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((row, i) => (
            <tr key={i}>
              {columns
                .filter((c) => !hidden.includes(c.key))
                .map((c) => (
                  <td key={c.key}>{row[c.key]}</td>
                ))}
              <td className="signature-col" />
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
