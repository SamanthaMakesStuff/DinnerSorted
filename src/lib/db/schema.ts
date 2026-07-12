/**
 * Postgres schema (Neon/Supabase via Drizzle).
 *
 * Deliberately minimal (data-protection principle: collect the minimum):
 * credentials in `users`, and the user's whole DinnerSorted document as one
 * validated JSONB blob in `user_data` — the same shape as the JSON export.
 */
import {
  boolean,
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

/**
 * Shared supermarket catalogue, filled by the companion scraper CLI
 * (tools/tesco-scraper) run from the owner's own machine. One row per
 * product; re-runs upsert by URL and mark unseen products unavailable.
 */
export const products = pgTable("products", {
  id: text("id").primaryKey(), // e.g. "tesco:307358055"
  supermarket: text("supermarket").notNull(),
  url: text("url").notNull().unique(),
  name: text("name").notNull(),
  pricePence: integer("price_pence"),
  sizeText: text("size_text").default("").notNull(),
  portions: integer("portions"),
  ingredientsText: text("ingredients_text").default("").notNull(),
  allergens: jsonb("allergens").$type<string[]>().default([]).notNull(),
  mayContain: jsonb("may_contain").$type<string[]>().default([]).notNull(),
  cookMinutes: integer("cook_minutes"),
  cookingInstructions: text("cooking_instructions").default("").notNull(),
  /** Kitchen tools mentioned in the instructions (any one suffices). */
  cookTools: jsonb("cook_tools").$type<string[]>().default([]).notNull(),
  dietFlags: jsonb("diet_flags").$type<string[]>().default([]).notNull(),
  category: text("category").default("").notNull(),
  imageUrl: text("image_url").default("").notNull(),
  available: boolean("available").default(true).notNull(),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
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
