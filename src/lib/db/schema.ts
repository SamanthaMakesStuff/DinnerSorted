/**
 * Postgres schema (Neon/Supabase via Drizzle).
 *
 * Deliberately minimal (data-protection principle: collect the minimum):
 * credentials in `users`, and the user's whole DinnerSorted document as one
 * validated JSONB blob in `user_data` — the same shape as the JSON export.
 */
import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  // Login rate limiting, durable across serverless instances.
  failedLogins: integer("failed_logins").default(0).notNull(),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
});

export const userData = pgTable("user_data", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
