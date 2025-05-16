import { relations } from 'drizzle-orm';
import { doublePrecision, index, integer, pgTable, real, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { drivers, paymentMethods, payments, promoCodes, tripBids, vehicleTypes } from '@/db/schema';

/**
 * Trips Table - Stores information about ride requests and completed trips
 */
export const trips = pgTable(
  'trips',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    driverId: uuid('driver_id').references(() => drivers.id),
    vehicleTypeId: uuid('vehicle_type_id')
      .notNull()
      .references(() => vehicleTypes.id),
    status: text('status').notNull().default('pending'), // 'pending', 'accepted', 'in_progress', 'completed', 'cancelled'
    pickupLocationLat: doublePrecision('pickup_location_lat').notNull(),
    pickupLocationLng: doublePrecision('pickup_location_lng').notNull(),
    pickupAddress: text('pickup_address').notNull(),
    dropoffLocationLat: doublePrecision('dropoff_location_lat').notNull(),
    dropoffLocationLng: doublePrecision('dropoff_location_lng').notNull(),
    dropoffAddress: text('dropoff_address').notNull(),
    estimatedDistance: doublePrecision('estimated_distance').notNull(), // in kilometers
    estimatedDuration: integer('estimated_duration').notNull(), // in minutes

    biddingEndTime: timestamp('bidding_end_time'),

    estimatedPrice: doublePrecision('estimated_price').notNull(),
    finalPrice: doublePrecision('final_price').notNull(),

    actualDistance: doublePrecision('actual_distance'), // in kilometers
    actualDuration: integer('actual_duration'), // in minutes
    startTime: timestamp('start_time'),
    endTime: timestamp('end_time'),
    cancellationReason: text('cancellation_reason'),
    cancelledBy: text('cancelled_by'), // 'rider' or 'driver'
    cancelledAt: timestamp('cancelled_at'),
    riderRating: real('rider_rating'),
    driverRating: real('driver_rating'),
    riderFeedback: text('rider_feedback'),
    driverFeedback: text('driver_feedback'),
    paymentMethodId: uuid('payment_method_id').references(() => paymentMethods.id),
    promoCodeId: uuid('promo_code_id').references(() => promoCodes.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('trips_driver_id_idx').on(table.driverId), index('trips_status_idx').on(table.status)]
);

export const tripsRelations = relations(trips, ({ one, many }) => ({
  driver: one(drivers, {
    fields: [trips.driverId],
    references: [drivers.id],
  }),
  vehicleType: one(vehicleTypes, {
    fields: [trips.vehicleTypeId],
    references: [vehicleTypes.id],
  }),
  paymentMethod: one(paymentMethods, {
    fields: [trips.paymentMethodId],
    references: [paymentMethods.id],
  }),
  promoCode: one(promoCodes, {
    fields: [trips.promoCodeId],
    references: [promoCodes.id],
  }),
  payment: one(payments, {
    fields: [trips.id],
    references: [payments.tripId],
  }),
  tripWaypoints: many(tripWaypoints),
  tripBids: many(tripBids),
}));

/**
 * Trip Waypoints Table - Stores intermediate stops for trips
 */
export const tripWaypoints = pgTable(
  'trip_waypoints',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    orderIndex: integer('order_index').notNull(),
    locationLat: doublePrecision('location_lat').notNull(),
    locationLng: doublePrecision('location_lng').notNull(),
    address: text('address').notNull(),
    arrivedAt: timestamp('arrived_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('trip_waypoints_trip_id_idx').on(table.tripId)]
);

export const tripWaypointsRelations = relations(tripWaypoints, ({ one }) => ({
  trip: one(trips, {
    fields: [tripWaypoints.tripId],
    references: [trips.id],
  }),
}));

/**
 * Trip Location Updates Table - Tracks driver's location during a trip
 */
export const tripLocationUpdates = pgTable(
  'trip_location_updates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    locationLat: doublePrecision('location_lat').notNull(),
    locationLng: doublePrecision('location_lng').notNull(),
    timestamp: timestamp('timestamp').defaultNow().notNull(),
  },
  (table) => [index('trip_location_updates_trip_id_idx').on(table.tripId), index('trip_location_updates_timestamp_idx').on(table.timestamp)]
);

export const tripLocationUpdatesRelations = relations(tripLocationUpdates, ({ one }) => ({
  trip: one(trips, {
    fields: [tripLocationUpdates.tripId],
    references: [trips.id],
  }),
}));
