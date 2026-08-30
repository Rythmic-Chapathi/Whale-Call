import { boolean, integer, jsonb, pgTable, real, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export type SupplyInventory = Record<string, number>;
export type SupplyOrderLineRecord = {
  itemId: string;
  quantity: number;
  depotId: string;
};

export const supplyItemsTable = pgTable("supply_items", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  unit: text("unit").notNull(),
  weightKg: real("weight_kg").notNull(),
  coldChain: boolean("cold_chain").notNull().default(false),
  criticality: integer("criticality").notNull(),
  maxPerOrder: integer("max_per_order").notNull(),
});

export const supplyDepotsTable = pgTable("supply_depots", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  islandId: text("island_id").notNull(),
  dockId: text("dock_id").notNull(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  hours: text("hours").notNull(),
  inventory: jsonb("inventory").$type<SupplyInventory>().notNull(),
  reserved: jsonb("reserved").$type<SupplyInventory>().notNull(),
});

export const supplyOrdersTable = pgTable("supply_orders", {
  id: text("id").primaryKey(),
  status: text("status").notNull().default("sourcing"),
  lines: jsonb("lines").$type<SupplyOrderLineRecord[]>().notNull(),
  requestedLines: jsonb("requested_lines").$type<Array<{ itemId: string; quantity: number }>>().notNull(),
  destinationIslandId: text("destination_island_id"),
  destinationDockId: text("destination_dock_id"),
  destinationLat: real("destination_lat").notNull(),
  destinationLng: real("destination_lng").notNull(),
  requesterNote: text("requester_note").notNull().default(""),
  urgency: text("urgency").notNull().default("routine"),
  accessibilityNeed: boolean("accessibility_need").notNull().default(false),
  linkedEmergencyId: text("linked_emergency_id"),
  boatId: text("boat_id"),
  totalWeightKg: real("total_weight_kg").notNull(),
  etaMinutes: integer("eta_minutes"),
  distanceKm: real("distance_km").notNull(),
  fare: real("fare").notNull(),
  unfilledLines: jsonb("unfilled_lines").$type<Array<{ itemId: string; quantity: number }>>().notNull(),
  allocationNote: text("allocation_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  targetDeliveryAt: timestamp("target_delivery_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
});

export const insertSupplyItemSchema = createInsertSchema(supplyItemsTable).omit({ id: true });
export const insertSupplyDepotSchema = createInsertSchema(supplyDepotsTable).omit({ id: true });
export const insertSupplyOrderSchema = createInsertSchema(supplyOrdersTable).omit({
  id: true,
  createdAt: true,
});

export type SupplyItemRow = typeof supplyItemsTable.$inferSelect;
export type SupplyDepotRow = typeof supplyDepotsTable.$inferSelect;
export type SupplyOrderRow = typeof supplyOrdersTable.$inferSelect;
export type InsertSupplyOrder = z.infer<typeof insertSupplyOrderSchema>;