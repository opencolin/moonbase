import "server-only";

/**
 * The one HTML shell every transactional email renders into.
 *
 * Deliberately table-free, inline-styled, and narrow: email clients are not
 * browsers, and the v3 "designed" broadcast builder is a separate concern
 * that will produce its own markup. This shell is for system mail, which
 * should stay plain and fast.
 */

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type Block =
  | { kind: "text"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "button"; label: string; url: string }
  | { kind: "meta"; rows: [string, string][] };

const INK = "#131517";
const MUTED = "#6b7280";
const LINE = "#e6e8eb";

export function renderHtml(opts: {
  preheader?: string;
  blocks: Block[];
  footer?: string;
}) {
  const body = opts.blocks
    .map((block) => {
      switch (block.kind) {
        case "heading":
          return `<h1 style="margin:0 0 16px;font-size:22px;font-weight:500;letter-spacing:-0.022em;color:${INK}">${escapeHtml(block.text)}</h1>`;
        case "text":
          return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${INK}">${escapeHtml(block.text)}</p>`;
        case "button":
          return `<p style="margin:24px 0"><a href="${escapeHtml(block.url)}" style="display:inline-block;background:${INK};color:#fff;text-decoration:none;font-size:15px;font-weight:500;padding:12px 22px;border-radius:10px">${escapeHtml(block.label)}</a></p>`;
        case "meta":
          return `<table style="margin:0 0 16px;border-collapse:collapse">${block.rows
            .map(
              ([k, v]) =>
                `<tr><td style="padding:4px 16px 4px 0;font-size:13px;color:${MUTED}">${escapeHtml(k)}</td><td style="padding:4px 0;font-size:14px;color:${INK}">${escapeHtml(v)}</td></tr>`,
            )
            .join("")}</table>`;
      }
    })
    .join("\n");

  const preheader = opts.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(opts.preheader)}</div>`
    : "";

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f7f8f9">
${preheader}
<div style="max-width:520px;margin:0 auto;padding:40px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif">
  <div style="background:#fff;border:1px solid ${LINE};border-radius:16px;padding:32px">
${body}
  </div>
  <p style="margin:20px 0 0;font-size:12px;line-height:1.5;color:${MUTED};text-align:center">${escapeHtml(opts.footer ?? "Sent by Moonbase")}</p>
</div>
</body></html>`;
}

/** Plain-text twin. Every email ships both — some clients, and all filters, want it. */
export function renderText(opts: { blocks: Block[]; footer?: string }) {
  const body = opts.blocks
    .map((block) => {
      switch (block.kind) {
        case "heading":
          return `${block.text}\n${"=".repeat(Math.min(block.text.length, 60))}`;
        case "text":
          return block.text;
        case "button":
          return `${block.label}: ${block.url}`;
        case "meta":
          return block.rows.map(([k, v]) => `${k}: ${v}`).join("\n");
      }
    })
    .join("\n\n");

  return `${body}\n\n—\n${opts.footer ?? "Sent by Moonbase"}\n`;
}
