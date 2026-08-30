import { integer, pgTable, real, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tripsTable = pgTable("trips", {
  id: text("id").primaryKey(),
  status: text("status").notNull().default("matching"),
  pickupIslandId: text("pickup_island_id").notNull(),
  pickupDockId: text("pickup_dock_id").notNull(),
  destinationIslandId: text("destination_island_id").notNull(),
  destinationDockId: text("destination_dock_id").notNull(),
  boatClass: text("boat_class").notNull(),
  passengerCount: integer("passenger_count").notNull(),
  boatId: text("boat_id").notNull(),
  price: real("price").notNull(),
  etaMinutes: integer("eta_minutes").notNull(),
  distanceKm: real("distance_km").notNull(),
  requestedAt: timestamp("requested_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  targetArrivalAt: timestamp("target_arrival_at", { withTimezone: true }).notNull(),
});

export const insertTripSchema = createInsertSchema(tripsTable).omit({
  id: true,
  requestedAt: true,
});
export type InsertTrip = z.infer<typeof insertTripSchema>;
export type Trip = typeof tripsTable.$inferSelect;