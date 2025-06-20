import { relations } from 'drizzle-orm';
import { doublePrecision, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { timestamps } from '@/db/column.helpers';
import { drivers, trips, vehicles } from '@/db/schema';

/**
 * Driver Candidates Table - Stores nearby drivers found during search
 * Limited to 5-8 drivers per search
 */
export const driverCandidates = pgTable(
  'driver_candidates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    driverId: uuid('driver_id')
      .notNull()
      .references(() => drivers.id),
    vehicleId: uuid('vehicle_id')
      .notNull()
      .references(() => vehicles.id),
    distanceToPickup: doublePrecision('distance_to_pickup').notNull(), // in kilometers
    estimatedTimeToPickup: doublePrecision('estimated_time_to_pickup').notNull(), // in minutes
    basePrice: doublePrecision('base_price').notNull(), // initial fare calculation
    currentBidAmount: doublePrecision('current_bid_amount'), // latest bid from this driver if bidding
    status: text('status').notNull().default('available'), // 'available', 'selected', 'rejected'
    lastLocationLat: doublePrecision('last_location_lat').notNull(),
    lastLocationLng: doublePrecision('last_location_lng').notNull(),
    lastLocationTimestamp: timestamp('last_location_timestamp').defaultNow().notNull(),
    ...timestamps,
  },
  (table) => [
    index('driver_candidates_trip_id_idx').on(table.tripId),
    index('driver_candidates_driver_id_idx').on(table.driverId),
  ]
);

// Relations
export const driverCandidatesRelations = relations(driverCandidates, ({ one }) => ({
  trip: one(trips, {
    fields: [driverCandidates.tripId],
    references: [trips.id],
  }),
  driver: one(drivers, {
    fields: [driverCandidates.driverId],
    references: [drivers.id],
  }),
  vehicle: one(vehicles, {
    fields: [driverCandidates.vehicleId],
    references: [vehicles.id],
  }),
}));

// Zod schemas for validation
export const selectDriverCandidateSchema = createSelectSchema(driverCandidates);
export type SelectDriverCandidate = z.infer<typeof selectDriverCandidateSchema>;

export const insertDriverCandidateSchema = createInsertSchema(driverCandidates, {
  distanceToPickup: z.number().positive(),
  estimatedTimeToPickup: z.number().positive(),
  basePrice: z.number().positive(),
  lastLocationLat: z.number(),
  lastLocationLng: z.number(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDriverCandidate = z.infer<typeof insertDriverCandidateSchema>;

export const updateDriverCandidateSchema = createInsertSchema(driverCandidates).partial().omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type UpdateDriverCandidate = z.infer<typeof updateDriverCandidateSchema>;
