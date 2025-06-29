import { relations } from 'drizzle-orm';
import { boolean, doublePrecision, index, integer, pgTable, real, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { driverPayouts, trips, user, vehicles } from '@/db/schema';

/**
 * Drivers Table - Stores driver-specific information
 */
export const drivers = pgTable(
  'drivers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    licenseNumber: text('license_number').notNull(),
    licenseExpiry: timestamp('license_expiry').notNull(),
    isVerified: boolean('is_verified').default(false).notNull(),
    isAvailable: boolean('is_available').default(false).notNull(),
    rating: real('rating'),
    totalTrips: integer('total_trips').default(0).notNull(),
    totalEarnings: doublePrecision('total_earnings').default(0).notNull(),
    accountBalance: doublePrecision('account_balance').default(0).notNull(),
    name: text('name'), // Driver's name (often populated from user table)
    fcmToken: text('fcm_token'), // Firebase Cloud Messaging token for push notifications
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('drivers_user_id_idx').on(table.userId)]
);

// Zod Schemas
export const selectDriverSchema = createSelectSchema(drivers);

export type SelectDriver = z.infer<typeof selectDriverSchema>;

export const insertDriverSchema = createInsertSchema(drivers, {
  licenseExpiry: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'licenseExpiry must be a valid date string (e.g., "2025-12-31")',
    })
    .transform((val) => new Date(val)), // Transform string to Date object
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDriver = z.infer<typeof insertDriverSchema>;

export const updateDriverSchema = insertDriverSchema.partial();

export type UpdateDriver = z.infer<typeof updateDriverSchema>;

// ---------------------------------------------------------

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
export const driverDocuments = pgTable(
  'driver_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    driverId: uuid('driver_id')
      .notNull()
      .references(() => drivers.id, { onDelete: 'cascade' }),
    documentType: text('document_type').notNull(), // 'license', 'insurance', 'registration', etc.
    documentUrl: text('document_url').notNull(),
    isVerified: boolean('is_verified').default(false).notNull(),
    verificationNotes: text('verification_notes'),
    expiryDate: timestamp('expiry_date'),
    uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
    verifiedAt: timestamp('verified_at'),
  },
  (table) => [index('driver_documents_driver_id_idx').on(table.driverId)]
);

export const driverDocumentsRelations = relations(driverDocuments, ({ one }) => ({
  driver: one(drivers, {
    fields: [driverDocuments.driverId],
    references: [drivers.id],
  }),
}));
