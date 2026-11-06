import { pgTable, serial, text, varchar, boolean, timestamp } from "drizzle-orm/pg-core";

// Knowledge-base passages shown to trainees. `seed` marks the starter passages
// shipped with the site; "Reset to sample" removes everything else.
export const passages = pgTable("passages", {
  id: serial().primaryKey(),
  category: varchar({ length: 40 }).notNull().default("Other"),
  title: varchar({ length: 200 }).notNull(),
  titleHi: varchar("title_hi", { length: 200 }).notNull().default(""),
  text: text().notNull(),
  textHi: text("text_hi").notNull().default(""),
  source: varchar({ length: 250 }).notNull().default(""),
  seed: boolean().notNull().default(false),
  // Approval workflow (same idea as the Django backend): only "approved" passages reach trainees.
  // "pending" = waiting for an approver, "archived" = hidden.
  status: varchar({ length: 10 }).notNull().default("approved"),
  createdBy: varchar("created_by", { length: 200 }).notNull().default(""),
  approvedBy: varchar("approved_by", { length: 200 }).notNull().default(""),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Anonymous chat log: no names or phone numbers.
export const chatLogs = pgTable("chat_logs", {
  id: serial().primaryKey(),
  question: varchar({ length: 500 }).notNull(),
  lang: varchar({ length: 2 }).notNull().default("en"),
  answered: boolean().notNull().default(false),
  matched: varchar({ length: 200 }).notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
