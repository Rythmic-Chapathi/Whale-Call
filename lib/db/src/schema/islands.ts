import { boolean, jsonb, pgTable, real, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export type Coordinate = { lat: number; lng: number };
export type Dock = { id: string; name: string; position: Coordinate };

export const islandsTable = pgTable("islands", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  tagline: text("tagline").notNull(),
  centerLat: real("center_lat").notNull(),
  centerLng: real("center_lng").notNull(),
  coastline: jsonb("coastline").$type<Coordinate[]>().notNull(),
  docks: jsonb("docks").$type<Dock[]>().notNull(),
  hasRescueStation: boolean("has_rescue_station").notNull().default(false),
});

export const insertIslandSchema = createInsertSchema(islandsTable).omit({
  id: true,
});
export type InsertIsland = z.infer<typeof insertIslandSchema>;
export type Island = typeof islandsTable.$inferSelect;