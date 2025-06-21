import { relations } from 'drizzle-orm';
import { doublePrecision, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { drivers, trips } from '@/db/schema';

/**
 * Trip Location Updates Table - Stores real-time location updates during trips
 */
export const tripLocationUpdates = pgTable(
  'trip_location_updates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    driverId: uuid('driver_id')
      .notNull()
      .references(() => drivers.id),
    locationLat: doublePrecision('location_lat').notNull(),
    locationLng: doublePrecision('location_lng').notNull(),
    heading: doublePrecision('heading'), // Direction in degrees (0-360)
    speed: doublePrecision('speed'), // Speed in km/h
    accuracy: doublePrecision('accuracy'), // Accuracy in meters
    timestamp: timestamp('timestamp').defaultNow().notNull(),
    status: text('status').notNull().default('active'), // 'active', 'inactive' (for filtering stale updates)
  },
  (table) => [
    index('trip_location_updates_trip_id_idx').on(table.tripId),
    index('trip_location_updates_driver_id_idx').on(table.driverId),
    index('trip_location_updates_timestamp_idx').on(table.timestamp),
  ]
);

// Relations
export const tripLocationUpdatesRelations = relations(tripLocationUpdates, ({ one }) => ({
  trip: one(trips, {
    fields: [tripLocationUpdates.tripId],
    references: [trips.id],
  }),
  driver: one(drivers, {
    fields: [tripLocationUpdates.driverId],
    references: [drivers.id],
  }),
}));

// Zod schemas for validation
export const selectLocationUpdateSchema = createSelectSchema(tripLocationUpdates);
export type SelectLocationUpdate = z.infer<typeof selectLocationUpdateSchema>;

export const insertLocationUpdateSchema = createInsertSchema(tripLocationUpdates, {
  locationLat: z.number(),
  locationLng: z.number(),
  heading: z.number().optional(),
  speed: z.number().optional(),
  accuracy: z.number().optional(),
}).omit({
  id: true,
  timestamp: true,
});

export type InsertLocationUpdate = z.infer<typeof insertLocationUpdateSchema>;
