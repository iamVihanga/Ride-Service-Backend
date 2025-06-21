import { relations } from 'drizzle-orm';
import { boolean, doublePrecision, index, integer, pgTable, real, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// Import directly from specific files to avoid circular references
import { timestamps } from '@/db/column.helpers';
import { user } from '@/db/schema/auth.schema';
import { drivers } from '@/routes/drivers/drivers.schema';
import { paymentMethods, payments, promoCodes } from '@/routes/payments/payments.schema';
import { vehicleTypes } from '@/routes/vehicles/vehicles.schema';
import { tripWaypoints } from './waypoints.schema';

/**
 * Trips Table - Stores information about ride requests and completed trips
 */
export const trips = pgTable(
  'trips',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(), // Passenger user ID
    driverId: uuid('driver_id').references(() => drivers.id),
    vehicleTypeId: uuid('vehicle_type_id')
      .notNull()
      .references(() => vehicleTypes.id),
    status: text('status').notNull().default('searching'), // 'searching', 'bidding', 'driver_assigned', 'driver_arriving', 'in_progress', 'completed', 'cancelled'
    pickupLocationLat: doublePrecision('pickup_location_lat').notNull(),
    pickupLocationLng: doublePrecision('pickup_location_lng').notNull(),
    pickupAddress: text('pickup_address').notNull(),
    // Primary dropoff location - final destination
    dropoffLocationLat: doublePrecision('dropoff_location_lat').notNull(),
    dropoffLocationLng: doublePrecision('dropoff_location_lng').notNull(),
    dropoffAddress: text('dropoff_address').notNull(),

    estimatedDistance: doublePrecision('estimated_distance').notNull(), // in kilometers
    estimatedDuration: integer('estimated_duration').notNull(), // in minutes

    biddingEnabled: boolean('bidding_enabled').default(false).notNull(), // If bidding is enabled for this trip
    biddingEndTime: timestamp('bidding_end_time'), // When bidding ends and user must select

    estimatedPrice: doublePrecision('estimated_price').notNull(), // Base price
    finalPrice: doublePrecision('final_price'), // Final price after trip completion

    actualDistance: doublePrecision('actual_distance'), // in kilometers
    actualDuration: integer('actual_duration'), // in minutes

    // Trip progress timestamps
    driverAcceptedAt: timestamp('driver_accepted_at'),
    driverArrivedAt: timestamp('driver_arrived_at'),
    startTime: timestamp('start_time'),
    endTime: timestamp('end_time'),

    // Bidding-related fields
    bidSelectionTime: timestamp('bid_selection_time'), // When user selected a bid
    selectedBidId: uuid('selected_bid_id'), // The bid that was selected (reference added after tripBids is defined)

    // Cancellation details
    cancellationReason: text('cancellation_reason'),
    cancelledBy: text('cancelled_by'), // 'rider', 'driver' or 'system'
    cancelledAt: timestamp('cancelled_at'),

    // Ratings and feedback
    riderRating: real('rider_rating'),
    driverRating: real('driver_rating'),
    riderFeedback: text('rider_feedback'),
    driverFeedback: text('driver_feedback'),

    // Payment-related fields
    paymentMethodId: uuid('payment_method_id').references(() => paymentMethods.id),
    promoCodeId: uuid('promo_code_id').references(() => promoCodes.id),
    paymentStatus: text('payment_status').default('pending'), // 'pending', 'processing', 'completed', 'failed'

    // Push notification tokens
    riderFcmToken: text('rider_fcm_token'), // Firebase Cloud Messaging token for the rider
    driverFcmToken: text('driver_fcm_token'), // Firebase Cloud Messaging token for the driver

    ...timestamps, // Using the helper for created_at and updated_at
  },
  (table) => [index('trips_driver_id_idx').on(table.driverId), index('trips_status_idx').on(table.status)]
);

export const tripsRelations = relations(trips, ({ one, many }) => ({
  user: one(user, {
    fields: [trips.userId],
    references: [user.id],
  }),
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
  // We'll add tripBids relation after the tripBids schema is defined
}));

// Waypoints and Location updates are now in separate files:
// - waypoints.schema.ts
// - location-updates.schema.ts

// Add select schema for trips
export const selectTripSchema = createSelectSchema(trips);
export type SelectTrip = z.infer<typeof selectTripSchema>;

export const insertTripSchema = createInsertSchema(trips, {
  pickupLocationLat: z.number(),
  pickupLocationLng: z.number(),
  pickupAddress: z.string(),
  dropoffLocationLat: z.number(),
  dropoffLocationLng: z.number(),
  dropoffAddress: z.string(),
  estimatedDistance: z.number().positive(),
  estimatedDuration: z.number().int().positive(),
  estimatedPrice: z.number().positive(),
  vehicleTypeId: z.string().uuid(),
  biddingEnabled: z.boolean().optional(),
}).omit({
  id: true,
  driverId: true,
  createdAt: true,
  updatedAt: true,
  startTime: true,
  endTime: true,
  cancelledAt: true,
  driverAcceptedAt: true,
  driverArrivedAt: true,
  riderRating: true,
  driverRating: true,
  actualDistance: true,
  actualDuration: true,
  finalPrice: true,
  paymentStatus: true,
  selectedBidId: true,
});

export type InsertTrip = z.infer<typeof insertTripSchema>;

export const updateTripSchema = createInsertSchema(trips).partial().omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type UpdateTrip = z.infer<typeof updateTripSchema>;
