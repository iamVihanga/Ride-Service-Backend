import { relations } from 'drizzle-orm';
import { boolean, doublePrecision, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { drivers } from '@/db/schema';

/**
 * Vehicles Table - Stores information about drivers' vehicles
 */
export const vehicles = pgTable('vehicles', {
  id: uuid('id').primaryKey().defaultRandom(),
  driverId: uuid('driver_id').notNull().references(() => drivers.id, { onDelete: 'cascade' }),
  make: text('make').notNull(),
  model: text('model').notNull(),
  year: integer('year').notNull(),
  color: text('color').notNull(),
  licensePlate: text('license_plate').notNull().unique(),
  vehicleTypeId: uuid('vehicle_type_id').notNull().references(() => vehicleTypes.id),
  registrationNumber: text('registration_number').notNull(),
  registrationExpiry: timestamp('registration_expiry').notNull(),
  insuranceNumber: text('insurance_number').notNull(),
  insuranceExpiry: timestamp('insurance_expiry').notNull(),
  inspectionStatus: text('inspection_status').default('pending').notNull(),
  inspectionDate: timestamp('inspection_date'),
  capacity: integer('capacity').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  currentLocationLat: doublePrecision('current_location_lat'),
  currentLocationLng: doublePrecision('current_location_lng'),
  lastLocationUpdateAt: timestamp('last_location_update_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('vehicles_vehicle_type_id_idx').on(table.vehicleTypeId),
  index('vehicles_driver_id_idx').on(table.driverId),
  index('vehicles_location_idx').on(table.currentLocationLat, table.currentLocationLng),

]);

export const vehiclesRelations = relations(vehicles, ({ one, many }) => ({
  vehicleType: one(vehicleTypes, {
    fields: [vehicles.vehicleTypeId],
    references: [vehicleTypes.id],
  }),
  driver: one(drivers, {
    fields: [vehicles.driverId],
    references: [drivers.id],
  }),
}));


/**
 * Vehicle Types Table - Stores different types of vehicles (Economy, Premium, etc.)
 */
export const vehicleTypes = pgTable('vehicle_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  description: text('description'),
  basePrice: doublePrecision('base_price').notNull(),
  pricePerKm: doublePrecision('price_per_km').notNull(),
  pricePerMinute: doublePrecision('price_per_minute').notNull(),
  minimumFare: doublePrecision('minimum_fare').notNull(),
  capacity: integer('capacity').notNull(),
  iconUrl: text('icon_url'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const vehicleTypesRelations = relations(vehicleTypes, ({ many }) => ({
  vehicles: many(vehicles),
}));