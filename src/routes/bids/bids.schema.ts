import { relations } from 'drizzle-orm';
import { boolean, doublePrecision, index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { timestamps } from '@/db/column.helpers';
// Import directly from specific files to avoid circular references
import { drivers } from '@/routes/drivers/drivers.schema';
import { trips } from '@/routes/trips/trips.schema';
import { vehicles } from '@/routes/vehicles/vehicles.schema';

/**
 * Trip Bids Table - Stores bids from drivers for trips
 */
export const tripBids = pgTable(
  'trip_bids',
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
    bidAmount: doublePrecision('bid_amount').notNull(),
    status: text('status').notNull().default('pending'), // 'pending', 'accepted', 'rejected', 'expired'
    note: text('note'), // Optional message from driver to user
    estimatedArrivalTime: timestamp('estimated_arrival_time'), // When driver can arrive at pickup
    isSelected: boolean('is_selected').default(false).notNull(), // If this bid was selected by the user
    distanceToPickup: doublePrecision('distance_to_pickup'), // Distance from driver to pickup in km
    timeToPickup: doublePrecision('time_to_pickup'), // Estimated time to pickup in minutes
    lastKnownLocationLat: doublePrecision('last_known_location_lat'), // Driver's location when bid was placed
    lastKnownLocationLng: doublePrecision('last_known_location_lng'), // Driver's location when bid was placed
    ...timestamps, // Using the helper for created_at and updated_at
  },
  (table) => [
    index('trip_bids_trip_id_idx').on(table.tripId),
    index('trip_bids_driver_id_idx').on(table.driverId),
    index('trip_bids_vehicle_id_idx').on(table.vehicleId),
    index('trip_bids_status_idx').on(table.status),
    unique('trip_driver_vehicle_unique').on(table.tripId, table.driverId, table.vehicleId),
  ]
);

export const tripBidsRelations = relations(tripBids, ({ one }) => ({
  trip: one(trips, {
    fields: [tripBids.tripId],
    references: [trips.id],
  }),
  driver: one(drivers, {
    fields: [tripBids.driverId],
    references: [drivers.id],
  }),
  vehicle: one(vehicles, {
    fields: [tripBids.vehicleId],
    references: [vehicles.id],
  }),
}));

// Add reference from trips.selectedBidId to tripBids.id
export const selectTripBidSchema = createSelectSchema(tripBids);
export type SelectTripBid = z.infer<typeof selectTripBidSchema>;

export const insertTripBidSchema = createInsertSchema(tripBids, {
  tripId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  bidAmount: z.number().positive(),
  note: z.string().optional(),
  estimatedArrivalTime: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'estimatedArrivalTime must be a valid date string',
    })
    .transform((val) => new Date(val))
    .optional(),
  distanceToPickup: z.number().positive().optional(),
  timeToPickup: z.number().positive().optional(),
  lastKnownLocationLat: z.number().optional(),
  lastKnownLocationLng: z.number().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  isSelected: true,
  status: true,
});

export type InsertTripBid = z.infer<typeof insertTripBidSchema>;

export const updateTripBidSchema = createInsertSchema(tripBids).partial().omit({
  id: true,
  tripId: true,
  driverId: true,
  createdAt: true,
  updatedAt: true,
});

export type UpdateTripBid = z.infer<typeof updateTripBidSchema>;
