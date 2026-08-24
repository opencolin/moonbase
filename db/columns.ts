/**
 * Column primitives — the entire SQLite surface area of the schema.
 *
 * The Postgres port (v0.2) is meant to be a *single-file* change: swap the
 * bodies here and the `table` alias below, and `schema.ts` compiles
 * unchanged. That only holds if schema.ts uses these helpers and never
 * reaches for `integer(... { mode })` or raw `sqliteTable` directly.
 *
 * Postgres equivalents, for whoever does the port:
 *   table      → pgTable
 *   pk         → text("id").primaryKey()                      (unchanged)
 *   timestamp  → timestamp("x", { withTimezone: true })
 *   bool       → boolean("x")
 *   money      → numeric("x", { precision: 12, scale: 2 })
 *   int        → integer("x")                                 (unchanged)
 *   str        → text("x")                                    (unchanged)
 *
 * Note that libSQL stores timestamps as epoch integers and booleans as
 * 0/1; Drizzle's `mode` options are what hide that, and they are exactly
 * the SQLite-isms being quarantined here.
 */
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";

/** The table constructor. Swap for `pgTable` on the Postgres port. */
export const table = sqliteTable;

/** 12-char nanoid primary key, generated in app code (portable across dialects). */
export const pk = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => nanoid(12));

/** A foreign-key-shaped text column. */
export const fk = (name: string) => text(name);

/** Plain text. */
export const str = (name: string) => text(name);

/** Whole number. */
export const int = (name: string) => integer(name);

/** Boolean — 0/1 under SQLite, a real boolean under Postgres. */
export const bool = (name: string) => integer(name, { mode: "boolean" });

/** Point in time — epoch integer under SQLite, timestamptz under Postgres. */
export const timestamp = (name: string) => integer(name, { mode: "timestamp" });

/**
 * Currency in major units (dollars, not cents).
 *
 * `real` is a float, which is wrong for money and should become
 * `numeric(12, 2)` on the Postgres port. Left as-is only because the
 * existing `tickets.price` column already is one and changing it is a data
 * migration, not a type swap. Do not add new float money columns.
 */
export const money = (name: string) => real(name);

/** `created_at`, defaulted in app code so every dialect behaves the same. */
export const createdAt = () =>
  timestamp("created_at")
    .notNull()
    .$defaultFn(() => new Date());
