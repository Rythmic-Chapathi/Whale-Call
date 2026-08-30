import { boolean, integer, pgTable, real, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const boatsTable = pgTable("boats", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  boatClass: text("boat_class").notNull(),
  capacity: integer("capacity").notNull(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  heading: real("heading").notNull(),
  status: text("status").notNull().default("available"),
  driverId: text("driver_id").notNull(),
  homeIslandId: text("home_island_id").notNull(),
  emergencyEquipped: boolean("emergency_equipped").notNull().default(false),
});

export const insertBoatSchema = createInsertSchema(boatsTable).omit({
  id: true,
});
export type InsertBoat = z.infer<typeof insertBoatSchema>;
export type Boat = typeof boatsTable.$inferSelect;