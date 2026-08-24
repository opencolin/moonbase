import "server-only";

/**
 * Email transports.
 *
 * Chosen by env, so nothing above this layer knows or cares who delivers:
 *   RESEND_API_KEY set  → Resend (plain fetch, no SDK dependency)
 *   otherwise           → console (dev): logs the rendered mail, never sends
 *
 * v2–v4 add ~25 transactional emails on top of this. The contract to keep
 * stable is `Transport`: everything else can be swapped.
 */

export type Mail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

export type SendResult =
  | { ok: true; id?: string; transport: string }
  | { ok: false; error: string; transport: string };

export interface Transport {
  readonly name: string;
  send(mail: Mail): Promise<SendResult>;
}

const FROM = process.env.EMAIL_FROM ?? "Moonbase <noreply@moonbase.local>";

/** Dev default. Prints instead of sending so local flows are debuggable. */
const consoleTransport: Transport = {
  name: "console",
  async send(mail) {
    console.log(
      [
        "",
        "──────────── ✉️  email (not sent) ────────────",
        `To:      ${mail.to}`,
        `From:    ${FROM}`,
        `Subject: ${mail.subject}`,
        "",
        mail.text,
        "──────────────────────────────────────────────",
        "",
      ].join("\n"),
    );
    return { ok: true, transport: "console" };
  },
};

const resendTransport: Transport = {
  name: "resend",
  async send(mail) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: FROM,
          to: [mail.to],
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
          ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
        }),
      });

      if (!res.ok) {
        return {
          ok: false,
          transport: "resend",
          error: `${res.status} ${await res.text()}`,
        };
      }
      const body = (await res.json()) as { id?: string };
      return { ok: true, id: body.id, transport: "resend" };
    } catch (err) {
      return {
        ok: false,
        transport: "resend",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};

export function getTransport(): Transport {
  if (process.env.RESEND_API_KEY) return resendTransport;
  return consoleTransport;
}
