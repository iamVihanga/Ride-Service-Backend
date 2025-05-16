import { relations } from 'drizzle-orm';
import { boolean, doublePrecision, index, integer, pgTable, real, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { driverPayouts, trips, user, vehicles } from '@/db/schema';

/**
 * Drivers Table - Stores driver-specific information
 */
export const drivers = pgTable('drivers', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  licenseNumber: text('license_number').notNull(),
  licenseExpiry: timestamp('license_expiry').notNull(),
  isVerified: boolean('is_verified').default(false).notNull(),
  isAvailable: boolean('is_available').default(false).notNull(),
  rating: real('rating'),
  totalTrips: integer('total_trips').default(0).notNull(),
  totalEarnings: doublePrecision('total_earnings').default(0).notNull(),
  accountBalance: doublePrecision('account_balance').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('drivers_user_id_idx').on(table.userId)
]);



export const driversRelations = relations(drivers, ({ one, many }) => ({
  user: one(user, {
    fields: [drivers.userId],
    references: [user.id],
  }),
  vehicles: many(vehicles),
  trips: many(trips),
  driverDocuments: many(driverDocuments),
  driverPayouts: many(driverPayouts),
}));


/**
 * Driver Documents Table - Stores driver verification documents
 */
export const driverDocuments = pgTable('driver_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  driverId: uuid('driver_id').notNull().references(() => drivers.id, { onDelete: 'cascade' }),
  documentType: text('document_type').notNull(), // 'license', 'insurance', 'registration', etc.
  documentUrl: text('document_url').notNull(),
  isVerified: boolean('is_verified').default(false).notNull(),
  verificationNotes: text('verification_notes'),
  expiryDate: timestamp('expiry_date'),
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
  verifiedAt: timestamp('verified_at'),
}, (table) => [
  index('driver_documents_driver_id_idx').on(table.driverId)
]);

export const driverDocumentsRelations = relations(driverDocuments, ({ one }) => ({
  driver: one(drivers, {
    fields: [driverDocuments.driverId],
    references: [drivers.id],
  }),
}));