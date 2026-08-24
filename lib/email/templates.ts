import "server-only";
import { renderHtml, renderText, type Block } from "./layout";

/**
 * The template registry.
 *
 * Adding an email means adding one entry to `TemplatePayloads` and one
 * builder to `templates`. TypeScript then forces every call site to pass the
 * right payload, which is what keeps ~25 of these manageable by v4.
 *
 * Each builder returns blocks only; the shell renders both HTML and text so
 * the two can never drift.
 */

export type TemplatePayloads = {
  "registration.confirmed": {
    name: string;
    eventTitle: string;
    eventUrl: string;
    when: string;
    where?: string;
  };
  "registration.pending": {
    name: string;
    eventTitle: string;
    eventUrl: string;
  };
  "registration.approved": {
    name: string;
    eventTitle: string;
    eventUrl: string;
    when: string;
    where?: string;
  };
  "registration.declined": {
    name: string;
    eventTitle: string;
  };
  "registration.waitlisted": {
    name: string;
    eventTitle: string;
    eventUrl: string;
  };
};

export type TemplateId = keyof TemplatePayloads;

type Built = { subject: string; blocks: Block[]; preheader?: string };

const templates: {
  [K in TemplateId]: (payload: TemplatePayloads[K]) => Built;
} = {
  "registration.confirmed": (p) => ({
    subject: `You're going to ${p.eventTitle}`,
    preheader: `Your spot at ${p.eventTitle} is confirmed.`,
    blocks: [
      { kind: "heading", text: "You're in." },
      {
        kind: "text",
        text: `Hi ${p.name} — your spot at ${p.eventTitle} is confirmed. See you there.`,
      },
      {
        kind: "meta",
        rows: [
          ["When", p.when],
          ...(p.where ? ([["Where", p.where]] as [string, string][]) : []),
        ],
      },
      { kind: "button", label: "View event", url: p.eventUrl },
    ],
  }),

  "registration.pending": (p) => ({
    subject: `Request received — ${p.eventTitle}`,
    preheader: "The host is reviewing your request.",
    blocks: [
      { kind: "heading", text: "Request received" },
      {
        kind: "text",
        text: `Thanks ${p.name}. ${p.eventTitle} requires approval, so the host is reviewing your request. We'll email you as soon as they decide.`,
      },
      { kind: "button", label: "View event", url: p.eventUrl },
    ],
  }),

  "registration.approved": (p) => ({
    subject: `You're approved for ${p.eventTitle}`,
    preheader: `The host approved your request to join ${p.eventTitle}.`,
    blocks: [
      { kind: "heading", text: "You're approved" },
      {
        kind: "text",
        text: `Good news ${p.name} — the host approved your request to join ${p.eventTitle}.`,
      },
      {
        kind: "meta",
        rows: [
          ["When", p.when],
          ...(p.where ? ([["Where", p.where]] as [string, string][]) : []),
        ],
      },
      { kind: "button", label: "View event", url: p.eventUrl },
    ],
  }),

  "registration.declined": (p) => ({
    subject: `Update on your request — ${p.eventTitle}`,
    blocks: [
      { kind: "heading", text: "About your request" },
      {
        kind: "text",
        text: `Hi ${p.name} — unfortunately the host wasn't able to offer you a spot at ${p.eventTitle} this time. Thanks for your interest.`,
      },
    ],
  }),

  "registration.waitlisted": (p) => ({
    subject: `You're on the waitlist for ${p.eventTitle}`,
    preheader: "We'll email you if a spot opens up.",
    blocks: [
      { kind: "heading", text: "You're on the waitlist" },
      {
        kind: "text",
        text: `Hi ${p.name} — ${p.eventTitle} is at capacity, so you're on the waitlist. We'll email you the moment a spot opens up.`,
      },
      { kind: "button", label: "View event", url: p.eventUrl },
    ],
  }),
};

export function renderTemplate<K extends TemplateId>(
  id: K,
  payload: TemplatePayloads[K],
) {
  const built = templates[id](payload);
  return {
    subject: built.subject,
    html: renderHtml({ preheader: built.preheader, blocks: built.blocks }),
    text: renderText({ blocks: built.blocks }),
  };
}
