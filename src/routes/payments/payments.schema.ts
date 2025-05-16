import { relations } from 'drizzle-orm';
import { boolean, doublePrecision, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { drivers, trips, user } from '@/db/schema';

/**
 * Payment Methods Table - Stores payment methods for users
 */
export const paymentMethods = pgTable(
  'payment_methods',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // 'credit_card', 'debit_card', 'paypal', etc.
    providerName: text('provider_name').notNull(),
    providerToken: text('provider_token'), // Token from payment provider
    last4: text('last4'),
    expiryMonth: text('expiry_month'),
    expiryYear: text('expiry_year'),
    isDefault: boolean('is_default').default(false).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('payment_methods_user_id_idx').on(table.userId)]
);

export const paymentMethodsRelations = relations(paymentMethods, ({ one, many }) => ({
  user: one(user, {
    fields: [paymentMethods.userId],
    references: [user.id],
  }),
  trips: many(trips),
}));

/**
 * Payments Table - Stores payment information for trips
 */
export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trips.id)
      .unique(),
    amount: doublePrecision('amount').notNull(),
    status: text('status').notNull().default('pending'), // 'pending', 'completed', 'failed', 'refunded'
    paymentMethodId: uuid('payment_method_id').references(() => paymentMethods.id),
    transactionId: text('transaction_id'),
    baseFare: doublePrecision('base_fare').notNull(),
    distanceFare: doublePrecision('distance_fare').notNull(),
    timeFare: doublePrecision('time_fare').notNull(),
    serviceFee: doublePrecision('service_fee').notNull(),
    tax: doublePrecision('tax').notNull(),
    tip: doublePrecision('tip').default(0).notNull(),
    discountAmount: doublePrecision('discount_amount').default(0).notNull(),
    promoCodeId: uuid('promo_code_id').references(() => promoCodes.id),
    paymentIntentId: text('payment_intent_id'),
    stripeCustomerId: text('stripe_customer_id'),
    paymentError: text('payment_error'),
    refundReason: text('refund_reason'),
    refundedAt: timestamp('refunded_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('payments_trip_id_idx').on(table.tripId), index('payments_status_idx').on(table.status)]
);

export const paymentsRelations = relations(payments, ({ one }) => ({
  trip: one(trips, {
    fields: [payments.tripId],
    references: [trips.id],
  }),
  paymentMethod: one(paymentMethods, {
    fields: [payments.paymentMethodId],
    references: [paymentMethods.id],
  }),
  promoCode: one(promoCodes, {
    fields: [payments.promoCodeId],
    references: [promoCodes.id],
  }),
}));

/**
 * Driver Payouts Table - Stores payout information for drivers
 */
export const driverPayouts = pgTable(
  'driver_payouts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    driverId: uuid('driver_id')
      .notNull()
      .references(() => drivers.id),
    amount: doublePrecision('amount').notNull(),
    status: text('status').notNull().default('pending'), // 'pending', 'processed', 'failed'
    payoutMethod: text('payout_method').notNull(), // 'bank_transfer', 'paypal', etc.
    transactionId: text('transaction_id'),
    notes: text('notes'),
    processedAt: timestamp('processed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('driver_payouts_driver_id_idx').on(table.driverId), index('driver_payouts_status_idx').on(table.status)]
);

export const driverPayoutsRelations = relations(driverPayouts, ({ one }) => ({
  driver: one(drivers, {
    fields: [driverPayouts.driverId],
    references: [drivers.id],
  }),
}));

/**
 * Promo Codes Table - Stores promotional codes for discounts
 */
export const promoCodes = pgTable(
  'promo_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull().unique(),
    description: text('description'),
    discountType: text('discount_type').notNull(), // 'percentage', 'fixed'
    discountValue: doublePrecision('discount_value').notNull(),
    maxDiscountAmount: doublePrecision('max_discount_amount'),
    startDate: timestamp('start_date').notNull(),
    endDate: timestamp('end_date').notNull(),
    maxUses: integer('max_uses'),
    currentUses: integer('current_uses').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    minimumTripAmount: doublePrecision('minimum_trip_amount'),
    validForNewUsersOnly: boolean('valid_for_new_users_only').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('promo_codes_code_idx').on(table.code)]
);

export const promoCodesRelations = relations(promoCodes, ({ many }) => ({
  trips: many(trips),
  payments: many(payments),
}));
