/**
 * Media helper checks (v1). `pnpm media:check`
 *
 * These run on participant-submitted values that end up as HTML on our own
 * origin, so the hostile cases matter more than the happy path.
 */
import { ghUser, safeSlug, safeUrl, videoEmbed } from "../lib/media";

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures++;
    console.log(`✗ ${name}\n    got      ${JSON.stringify(actual)}\n    expected ${JSON.stringify(expected)}`);
  } else {
    console.log(`✓ ${name}`);
  }
}

/* ---- safeUrl: only https survives ---- */
check("https passes", safeUrl("https://example.com/a.png"), "https://example.com/a.png");
check("http dropped", safeUrl("http://example.com/a.png"), null);
check("javascript: dropped", safeUrl("javascript:alert(1)"), null);
check("data: dropped", safeUrl("data:text/html,<script>alert(1)</script>"), null);
check("protocol-relative dropped", safeUrl("//example.com/a.png"), null);
check("empty dropped", safeUrl("   "), null);
check("garbage dropped", safeUrl("not a url"), null);

/* ---- videoEmbed ---- */
check("youtube watch", videoEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), {
  kind: "iframe",
  src: "https://www.youtube.com/embed/dQw4w9WgXcQ",
  title: "YouTube video player",
});
check("youtu.be", videoEmbed("https://youtu.be/dQw4w9WgXcQ"), {
  kind: "iframe",
  src: "https://www.youtube.com/embed/dQw4w9WgXcQ",
  title: "YouTube video player",
});
check("vimeo", videoEmbed("https://vimeo.com/123456789"), {
  kind: "iframe",
  src: "https://player.vimeo.com/video/123456789",
  title: "Vimeo video player",
});
check(
  "loom",
  videoEmbed("https://www.loom.com/share/0123456789abcdef0123456789abcdef"),
  {
    kind: "iframe",
    src: "https://www.loom.com/embed/0123456789abcdef0123456789abcdef",
    title: "Loom video player",
  },
);
check("mp4 file", videoEmbed("https://cdn.example.com/demo.mp4"), {
  kind: "file",
  src: "https://cdn.example.com/demo.mp4",
});

// The one that matters: lookalike hosts must not match.
check("youtube lookalike host rejected", videoEmbed("https://youtube.com.evil.tld/watch?v=dQw4w9WgXcQ"), null);
check("http youtube rejected", videoEmbed("http://youtube.com/watch?v=dQw4w9WgXcQ"), null);
check("unknown host rejected", videoEmbed("https://example.com/video"), null);
check("bad youtube id rejected", videoEmbed("https://youtube.com/watch?v=tooshort"), null);

/* ---- ghUser ---- */
check("valid handle", ghUser("opencolin"), "opencolin");
check("strips @", ghUser("@opencolin"), "opencolin");
check("rejects spaces", ghUser("not a user"), null);
check("rejects trailing dash", ghUser("bad-"), null);

/* ---- safeSlug ---- */
check("slugifies", safeSlug("Depth Charge!! 2026"), "depth-charge-2026");
check("empty falls back", safeSlug("!!!"), "project");

console.log(failures ? `\n✗ ${failures} failure(s)` : "\n✓ all media checks passed");
process.exit(failures ? 1 : 0);
