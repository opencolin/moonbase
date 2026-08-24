import "server-only";
import { getTransport, type SendResult } from "./transport";
import {
  renderTemplate,
  type TemplateId,
  type TemplatePayloads,
} from "./templates";

export type { TemplateId, TemplatePayloads } from "./templates";
export { renderTemplate } from "./templates";

/**
 * Send a transactional email.
 *
 * Never throws. Email is a side effect of a user action that has already
 * succeeded — a bounced confirmation must not roll back the registration
 * that caused it. Failures are logged and returned, and callers are free to
 * ignore the result.
 *
 *   await sendMail("registration.confirmed", user.email, { ... })
 */
export async function sendMail<K extends TemplateId>(
  id: K,
  to: string,
  payload: TemplatePayloads[K],
): Promise<SendResult> {
  const transport = getTransport();
  try {
    const { subject, html, text } = renderTemplate(id, payload);
    const result = await transport.send({ to, subject, html, text });
    if (!result.ok) {
      console.error(`[email] ${id} → ${to} failed: ${result.error}`);
    }
    return result;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[email] ${id} → ${to} threw: ${error}`);
    return { ok: false, error, transport: transport.name };
  }
}

/** Absolute URL for links inside emails. */
export function absoluteUrl(path: string) {
  const base =
    process.env.APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
    "http://localhost:3100";
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}
