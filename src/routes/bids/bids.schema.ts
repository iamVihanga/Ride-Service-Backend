import { relations } from 'drizzle-orm';
import { boolean, doublePrecision, index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

import { drivers, trips, vehicles } from '@/db/schema';

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
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
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
