import { integer, pgTable, real, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const driversTable = pgTable("drivers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  avatar: text("avatar").notNull(),
  rating: real("rating").notNull(),
  tripsCompleted: integer("trips_completed").notNull(),
  yearsActive: integer("years_active").notNull(),
  languages: text("languages").array().notNull(),
  certifications: text("certifications").array().notNull(),
});

export const insertDriverSchema = createInsertSchema(driversTable).omit({
  id: true,
});
export type InsertDriver = z.infer<typeof insertDriverSchema>;
export type Driver = typeof driversTable.$inferSelect;