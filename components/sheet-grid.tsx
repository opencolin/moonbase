"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SheetColumn } from "@/lib/attendee-sheet";
import { cn } from "@/lib/utils";

/**
 * A spreadsheet grid, deliberately close to Google Sheets in feel:
 * A/B/C column letters, row numbers, a sticky frozen header, single-cell and
 * range selection, arrow/tab/enter navigation, and Cmd-C copy as TSV so a
 * selection pastes straight into a real spreadsheet.
 *
 * It is read-only. Attendee data is owned by registration, so an editable
 * grid would need a conflict story it doesn't have yet; navigation, sorting,
 * copying and printing are what the door actually needs.
 */

type SortDir = "asc" | "desc";
type Cell = { row: number; col: number };

/** 0 → A, 25 → Z, 26 → AA. */
function colLetter(index: number) {
  let label = "";
  let n = index;
  while (n >= 0) {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
}

export function SheetGrid({
  columns,
  rows,
  hiddenKeys,
  emptyLabel = "No attendees yet.",
}: {
  columns: SheetColumn[];
  rows: Record<string, string>[];
  hiddenKeys?: string[];
  emptyLabel?: string;
}) {
  const cols = useMemo(
    () => columns.filter((c) => !hiddenKeys?.includes(c.key)),
    [columns, hiddenKeys],
  );

  const [sort, setSort] = useState<{ key: string; dir: SortDir } | null>(null);
  /**
   * Anchor and focus live in one state object and are always updated
   * together. Keeping them in two `useState`s meant extending a selection
   * had to call `setAnchor` from inside `setFocus`'s updater — an impure
   * updater, which React is free to re-run or discard, and which silently
   * dropped shift-arrow extensions.
   */
  const [sel, setSel] = useState<{ anchor: Cell; focus: Cell }>({
    anchor: { row: 0, col: 0 },
    focus: { row: 0, col: 0 },
  });
  const { anchor, focus } = sel;
  const [copied, setCopied] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const select = useCallback((cell: Cell) => {
    setSel({ anchor: cell, focus: cell });
  }, []);

  const extendTo = useCallback((cell: Cell) => {
    setSel((prev) => ({ anchor: prev.anchor, focus: cell }));
  }, []);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    const numeric = col?.type === "number";
    return [...rows].sort((a, b) => {
      const x = a[sort.key] ?? "";
      const y = b[sort.key] ?? "";
      const cmp = numeric
        ? Number(x || 0) - Number(y || 0)
        : x.localeCompare(y, undefined, { sensitivity: "base" });
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [rows, sort, columns]);

  // Selection rectangle between anchor and focus.
  const range = useMemo(
    () => ({
      top: Math.min(anchor.row, focus.row),
      bottom: Math.max(anchor.row, focus.row),
      left: Math.min(anchor.col, focus.col),
      right: Math.max(anchor.col, focus.col),
    }),
    [anchor, focus],
  );

  const inRange = (r: number, c: number) =>
    r >= range.top && r <= range.bottom && c >= range.left && c <= range.right;

  const copySelection = useCallback(async () => {
    const lines: string[] = [];
    for (let r = range.top; r <= range.bottom; r++) {
      const cells: string[] = [];
      for (let c = range.left; c <= range.right; c++) {
        cells.push(sorted[r]?.[cols[c].key] ?? "");
      }
      lines.push(cells.join("\t"));
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard can be blocked; the selection still works.
    }
  }, [range, sorted, cols]);

  const move = useCallback(
    (dr: number, dc: number, extend: boolean) => {
      setSel((prev) => {
        const next = {
          row: Math.max(0, Math.min(sorted.length - 1, prev.focus.row + dr)),
          col: Math.max(0, Math.min(cols.length - 1, prev.focus.col + dc)),
        };
        return { anchor: extend ? prev.anchor : next, focus: next };
      });
    },
    [sorted.length, cols.length],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === "c") {
        e.preventDefault();
        void copySelection();
        return;
      }
      if (mod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSel({
          anchor: { row: 0, col: 0 },
          focus: { row: sorted.length - 1, col: cols.length - 1 },
        });
        return;
      }

      const shift = e.shiftKey;
      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          move(-1, 0, shift);
          break;
        case "ArrowDown":
        case "Enter":
          e.preventDefault();
          move(1, 0, shift && e.key !== "Enter");
          break;
        case "ArrowLeft":
          e.preventDefault();
          move(0, -1, shift);
          break;
        case "ArrowRight":
          e.preventDefault();
          move(0, 1, shift);
          break;
        case "Tab":
          e.preventDefault();
          move(0, shift ? -1 : 1, false);
          break;
        case "Home":
          e.preventDefault();
          select({ row: focus.row, col: 0 });
          break;
        case "End":
          e.preventDefault();
          select({ row: focus.row, col: cols.length - 1 });
          break;
      }
    },
    [copySelection, move, select, focus.row, cols.length, sorted.length],
  );

  // Keep the focused cell in view as the user arrows around.
  useEffect(() => {
    gridRef.current
      ?.querySelector<HTMLElement>('[data-focused="true"]')
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [focus]);

  const toggleSort = (key: string) =>
    setSort((prev) =>
      prev?.key === key
        ? prev.dir === "asc"
          ? { key, dir: "desc" }
          : null
        : { key, dir: "asc" },
    );

  if (!rows.length) {
    return (
      <p className="rounded-lg border border-dashed border-line px-6 py-12 text-center text-ink-secondary">
        {emptyLabel}
      </p>
    );
  }

  const selectionLabel =
    range.top === range.bottom && range.left === range.right
      ? `${colLetter(range.left)}${range.top + 1}`
      : `${(range.bottom - range.top + 1) * (range.right - range.left + 1)} cells`;

  return (
    <div className="sheet-wrap">
      <div
        ref={gridRef}
        role="grid"
        tabIndex={0}
        onKeyDown={onKeyDown}
        aria-label="Attendees"
        className="sheet-scroll max-h-[70vh] overflow-auto rounded-lg border border-[#c0c4c8] bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1a73e8]/40"
      >
        <table className="border-collapse font-sans text-[13px] text-[#202124]">
          {/* Column letters — the Sheets tell */}
          <thead>
            <tr className="sheet-letters">
              <th className="sticky left-0 top-0 z-30 h-6 w-11 border-b border-r border-[#c0c4c8] bg-[#f8f9fa]" />
              {cols.map((c, i) => (
                <th
                  key={`L-${c.key}`}
                  className="sticky top-0 z-20 h-6 border-b border-r border-[#c0c4c8] bg-[#f8f9fa] text-center text-[11px] font-normal text-[#5f6368]"
                  style={{ minWidth: c.width ?? 140 }}
                >
                  {colLetter(i)}
                </th>
              ))}
            </tr>
            <tr>
              <th className="sticky left-0 top-6 z-30 h-8 w-11 border-b border-r border-[#c0c4c8] bg-[#f8f9fa]" />
              {cols.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={
                    sort?.key === c.key
                      ? sort.dir === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                  className="sticky top-6 z-20 h-8 border-b border-r border-[#c0c4c8] bg-[#f8f9fa] px-2 text-left font-medium"
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(c.key)}
                    className="flex w-full items-center justify-between gap-1 hover:text-[#1a73e8]"
                  >
                    <span className="truncate">{c.label}</span>
                    <span aria-hidden className="text-[9px] text-[#5f6368]">
                      {sort?.key === c.key ? (sort.dir === "asc" ? "▲" : "▼") : ""}
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {sorted.map((row, r) => (
              <tr key={r}>
                <th
                  scope="row"
                  className={cn(
                    "sticky left-0 z-10 h-[26px] w-11 border-b border-r border-[#c0c4c8] text-center text-[11px] font-normal text-[#5f6368]",
                    r >= range.top && r <= range.bottom
                      ? "bg-[#d3e3fd]"
                      : "bg-[#f8f9fa]",
                  )}
                >
                  {r + 1}
                </th>
                {cols.map((c, ci) => {
                  const selected = inRange(r, ci);
                  const focused = focus.row === r && focus.col === ci;
                  return (
                    <td
                      key={c.key}
                      data-focused={focused}
                      onMouseDown={(e) => {
                        if (e.shiftKey) extendTo({ row: r, col: ci });
                        else select({ row: r, col: ci });
                        gridRef.current?.focus();
                      }}
                      className={cn(
                        "h-[26px] cursor-cell truncate border-b border-r border-[#e0e0e0] px-2",
                        c.type === "number" && "text-right tabular-nums",
                        selected && !focused && "bg-[#e8f0fe]",
                        focused &&
                          "relative z-[5] outline outline-2 -outline-offset-1 outline-[#1a73e8]",
                      )}
                      style={{ maxWidth: c.width ?? 140 }}
                      title={row[c.key] || undefined}
                    >
                      {row[c.key]}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Status bar, as in Sheets */}
      <div className="sheet-status mt-2 flex items-center gap-4 text-[12px] text-ink-tertiary">
        <span>
          {sorted.length} {sorted.length === 1 ? "row" : "rows"}
        </span>
        <span>Selected {selectionLabel}</span>
        <button
          type="button"
          onClick={() => void copySelection()}
          className="text-ink-secondary underline-offset-2 hover:text-ink hover:underline"
        >
          {copied ? "Copied" : "Copy selection"}
        </button>
        <span className="ml-auto hidden sm:inline">
          Arrows move · Shift extends · ⌘C copies
        </span>
      </div>
    </div>
  );
}
