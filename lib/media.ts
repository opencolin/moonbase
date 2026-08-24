/**
 * Media handling, ported from `buildspacetv/sprint`.
 *
 * Everything here treats input as hostile. In Sprint the values came from
 * public GitHub issues; here they come from participant-submitted forms and
 * land in HTML on our own origin. Same threat model, same rules:
 *
 *   - only `https://` survives — no `javascript:`, `data:`, or protocol-relative
 *   - YouTube / Vimeo / Loom become embeds
 *   - .mp4 / .webm / .mov render in a native <video>
 *   - anything else is dropped rather than rendered
 *
 * This module is pure and dependency-free so it can be unit-tested directly.
 */

export type VideoEmbed =
  | { kind: "iframe"; src: string; title: string }
  | { kind: "file"; src: string };

/** `https://` URLs only. Returns null for anything else. */
export function safeUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** GitHub's own username grammar — used to validate handles before linking. */
export function ghUser(input: string | null | undefined): string | null {
  if (!input) return null;
  const handle = input.trim().replace(/^@/, "");
  return /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(handle)
    ? handle
    : null;
}

/** Reduce arbitrary text to a URL-safe slug. */
export function safeSlug(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "project"
  );
}

const VIDEO_FILE = /\.(mp4|webm|mov)(\?.*)?$/i;

/**
 * Turn a video URL into something renderable, or null to drop it.
 *
 * Host matching is on exact hostnames, never `includes()` — `youtube.com.evil.tld`
 * must not match.
 */
export function videoEmbed(input: string | null | undefined): VideoEmbed | null {
  const safe = safeUrl(input);
  if (!safe) return null;

  const url = new URL(safe);
  const host = url.hostname.replace(/^www\./, "");

  // YouTube
  if (host === "youtube.com" || host === "m.youtube.com") {
    const id = url.searchParams.get("v");
    if (id && /^[\w-]{11}$/.test(id)) {
      return {
        kind: "iframe",
        src: `https://www.youtube.com/embed/${id}`,
        title: "YouTube video player",
      };
    }
    const shorts = url.pathname.match(/^\/(?:shorts|embed)\/([\w-]{11})/);
    if (shorts) {
      return {
        kind: "iframe",
        src: `https://www.youtube.com/embed/${shorts[1]}`,
        title: "YouTube video player",
      };
    }
    return null;
  }
  if (host === "youtu.be") {
    const id = url.pathname.slice(1);
    return /^[\w-]{11}$/.test(id)
      ? {
          kind: "iframe",
          src: `https://www.youtube.com/embed/${id}`,
          title: "YouTube video player",
        }
      : null;
  }

  // Vimeo
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = url.pathname.match(/(\d{6,})/)?.[1];
    return id
      ? {
          kind: "iframe",
          src: `https://player.vimeo.com/video/${id}`,
          title: "Vimeo video player",
        }
      : null;
  }

  // Loom
  if (host === "loom.com") {
    const id = url.pathname.match(/\/(?:share|embed)\/([0-9a-f]{32})/i)?.[1];
    return id
      ? {
          kind: "iframe",
          src: `https://www.loom.com/embed/${id}`,
          title: "Loom video player",
        }
      : null;
  }

  // Direct file
  if (VIDEO_FILE.test(url.pathname)) return { kind: "file", src: safe };

  return null;
}

/** Image URLs, filtered to https. First one is the cover / og:image. */
export function safeImages(urls: (string | null | undefined)[]): string[] {
  return urls.map(safeUrl).filter((u): u is string => u !== null);
}

export function coverImage(urls: (string | null | undefined)[]): string | null {
  return safeImages(urls)[0] ?? null;
}
