import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

/**
 * Resolve the database URL.
 *
 * `DATABASE_URL` always wins — point it at Turso (or any libSQL host) and
 * nothing below applies.
 *
 * Without one, a Vercel deploy falls back to a *demo* database: the seeded
 * `luma.db` is traced into the bundle at build time and copied to /tmp on
 * cold start, because everything outside /tmp is read-only there. Writes
 * then work for the life of that instance but are neither shared between
 * instances nor durable across cold starts. That is fine for showing the
 * app and wrong for anything real — set DATABASE_URL before it matters.
 */
function resolveUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (!process.env.VERCEL) return "file:./luma.db";

  const target = "/tmp/luma.db";
  try {
    if (!fs.existsSync(target)) {
      const source = path.join(process.cwd(), "luma.db");
      if (fs.existsSync(source)) fs.copyFileSync(source, target);
    }
  } catch (err) {
    console.error("[db] could not stage the demo database:", err);
  }
  return `file:${target}`;
}

const authToken = process.env.DATABASE_AUTH_TOKEN;

// Reuse the client across hot reloads in dev to avoid exhausting handles.
const globalForDb = globalThis as unknown as {
  __lumaClient?: ReturnType<typeof createClient>;
};

const client =
  globalForDb.__lumaClient ?? createClient({ url: resolveUrl(), authToken });
if (process.env.NODE_ENV !== "production") globalForDb.__lumaClient = client;

export const db = drizzle(client, { schema });
export { schema };
