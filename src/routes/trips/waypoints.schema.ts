import { relations } from 'drizzle-orm';
import { boolean, doublePrecision, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { timestamps } from '@/db/column.helpers';
import { trips } from '@/db/schema';

/**
 * Trip Waypoints Table - Stores multiple drop-off locations for a trip
 */
export const tripWaypoints = pgTable(
  'trip_waypoints',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    sequenceNumber: integer('sequence_number').notNull(), // Order of waypoints
    locationLat: doublePrecision('location_lat').notNull(),
    locationLng: doublePrecision('location_lng').notNull(),
    address: text('address').notNull(),
    description: text('description'), // Optional description/note for this waypoint
    isCompleted: boolean('is_completed').default(false).notNull(), // Whether this waypoint has been visited
    arrivedAt: timestamp('arrived_at'), // When driver arrived at this waypoint
    ...timestamps,
  },
  (table) => [
    index('trip_waypoints_trip_id_idx').on(table.tripId),
    index('trip_waypoints_sequence_number_idx').on(table.sequenceNumber),
  ]
);

// Relations
export const tripWaypointsRelations = relations(tripWaypoints, ({ one }) => ({
  trip: one(trips, {
    fields: [tripWaypoints.tripId],
    references: [trips.id],
  }),
}));

// Zod schemas for validation
export const selectWaypointSchema = createSelectSchema(tripWaypoints);
export type SelectWaypoint = z.infer<typeof selectWaypointSchema>;

export const insertWaypointSchema = createInsertSchema(tripWaypoints, {
  locationLat: z.number(),
  locationLng: z.number(),
  address: z.string(),
  sequenceNumber: z.number().int().min(1),
}).omit({
  id: true,
  isCompleted: true,
  arrivedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertWaypoint = z.infer<typeof insertWaypointSchema>;

export const updateWaypointSchema = createInsertSchema(tripWaypoints).partial().omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
