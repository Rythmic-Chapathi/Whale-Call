import { real, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const emergenciesTable = pgTable("emergencies", {
  id: text("id").primaryKey(),
  status: text("status").notNull().default("dispatching"),
  situation: text("situation").notNull(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  notes: text("notes").notNull(),
  rescueBoatId: text("rescue_boat_id").notNull(),
  etaMinutes: real("eta_minutes").notNull(),
  distanceKm: real("distance_km").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  tripId: text("trip_id"),
});

export const insertEmergencySchema = createInsertSchema(emergenciesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertEmergency = z.infer<typeof insertEmergencySchema>;
export type Emergency = typeof emergenciesTable.$inferSelect;