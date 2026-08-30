import { boolean, integer, pgTable, real, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
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

export const driverApplicationsTable = pgTable("driver_applications", {
  id: text("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  homeIslandId: text("home_island_id").notNull(),
  yearsExperience: integer("years_experience").notNull(),
  boatClasses: text("boat_classes").array().notNull(),
  languages: text("languages").array().notNull(),
  certifications: text("certifications").array().notNull(),
  availability: text("availability").notNull(),
  experience: text("experience").notNull(),
  safetyRecord: text("safety_record").notNull(),
  motivation: text("motivation").notNull(),
  consent: boolean("consent").notNull().default(true),
  status: text("status").notNull().default("pending"),
  rejectionReason: text("rejection_reason"),
  driverId: text("driver_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("driver_applications_email_unique").on(table.email),
]);

export const driverReviewsTable = pgTable("driver_reviews", {
  id: text("id").primaryKey(),
  driverId: text("driver_id").notNull(),
  reviewerId: text("reviewer_id").notNull(),
  reviewerName: text("reviewer_name").notNull(),
  rating: integer("rating").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("driver_reviews_driver_reviewer_unique").on(table.driverId, table.reviewerId),
]);

export const insertDriverSchema = createInsertSchema(driversTable).omit({
  id: true,
});
export type InsertDriver = z.infer<typeof insertDriverSchema>;
export type Driver = typeof driversTable.$inferSelect;
export const insertDriverApplicationSchema = createInsertSchema(driverApplicationsTable).omit({
  id: true,
  createdAt: true,
  reviewedAt: true,
  status: true,
  rejectionReason: true,
  driverId: true,
});
export type InsertDriverApplication = z.infer<typeof insertDriverApplicationSchema>;
export type DriverApplication = typeof driverApplicationsTable.$inferSelect;
export const insertDriverReviewSchema = createInsertSchema(driverReviewsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertDriverReview = z.infer<typeof insertDriverReviewSchema>;
export type DriverReview = typeof driverReviewsTable.$inferSelect;